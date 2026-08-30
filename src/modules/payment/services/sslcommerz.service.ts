import { prisma, transaction } from "../../../lib/prisma.ts";
import { AppError } from "../../../common/errors/AppError.ts";
import { sslcommerzProvider } from "../providers/sslcommerz.provider.ts";
import type {
  SslcommerzFailCancelInput,
  SslcommerzIpnInput,
  SslcommerzSuccessInput,
} from "../validators/payment.validators.ts";

const findPaymentByProviderReference = async (tranId: string) => {
  if (!tranId) throw new AppError("Payment reference is missing", 400);

  const payment = await prisma.payment.findUnique({
    where: { providerReference: tranId },
  });

  if (!payment) throw new AppError("Payment not found", 404);

  return payment;
};

const toCustomerPayment = (payment: {
  id: string;
  method: string;
  status: string;
  amount: unknown;
  currency: string;
  createdAt: Date;
}) => ({
  id: payment.id,
  method: payment.method,
  status: payment.status,
  amount: payment.amount,
  currency: payment.currency,
  createdAt: payment.createdAt,
});

const assertAmountMatches = (expected: number, actual?: number) => {
  if (actual !== undefined && Math.abs(actual - expected) > 0.01) {
    throw new AppError(
      `Transaction amount ${actual} does not match payment amount ${expected}`,
      400
    );
  }
};

export const handleSslcommerzSuccess = async (
  input: SslcommerzSuccessInput
) => {
  const verification = await sslcommerzProvider.verifyTransaction(input.val_id);

  if (!verification.valid) {
    throw new AppError("Payment could not be verified with the gateway", 400);
  }

  const payment = await findPaymentByProviderReference(input.tran_id);
  assertAmountMatches(Number(payment.amount), verification.amount);

  if (payment.status === "SUCCESS" || payment.status === "COLLECTED") {
    return { payment: toCustomerPayment(payment) };
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCESS",
      paidAt: payment.paidAt ?? new Date(),
    },
    include: { order: true },
  });

  await prisma.$transaction([
    prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        eventType: "PAYMENT_SUCCESS",
        metadata: {
          source: "sslcommerz-success",
          valId: input.val_id,
          verified: true,
        },
      },
    }),
    prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        transactionReference: verification.transactionId,
        gatewayResponse: verification.raw as object,
        status: "SUCCESS",
        amount: payment.amount,
      },
    }),
  ]);

  return { payment: toCustomerPayment(updated) };
};

export const handleSslcommerzFail = async (input: SslcommerzFailCancelInput) => {
  const payment = await findPaymentByProviderReference(input.tran_id);

  if (payment.status === "SUCCESS" || payment.status === "COLLECTED") {
    return { payment: toCustomerPayment(payment) };
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "FAILED" },
  });

  await prisma.paymentEvent.create({
    data: {
      paymentId: payment.id,
      eventType: "PAYMENT_FAILED",
      metadata: { source: "sslcommerz-fail" },
    },
  });

  return { payment: toCustomerPayment(updated) };
};

export const handleSslcommerzCancel = async (
  input: SslcommerzFailCancelInput
) => {
  const payment = await findPaymentByProviderReference(input.tran_id);

  if (payment.status === "SUCCESS" || payment.status === "COLLECTED") {
    return { payment: toCustomerPayment(payment) };
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "CANCELLED" },
  });

  await prisma.paymentEvent.create({
    data: {
      paymentId: payment.id,
      eventType: "PAYMENT_CANCELLED",
      metadata: { source: "sslcommerz-cancel" },
    },
  });

  return { payment: toCustomerPayment(updated) };
};

export const handleSslcommerzIpn = async (input: SslcommerzIpnInput) => {
  const signatureValid = sslcommerzProvider.verifyWebhookSignature(
    input as Record<string, string>
  );

  if (!signatureValid) {
    throw new AppError("Invalid SSLCommerz webhook signature", 401);
  }

  const webhookLog = await prisma.paymentWebhookLog.upsert({
    where: {
      provider_externalEventId: {
        provider: "SSLCOMMERZ",
        externalEventId: input.val_id,
      },
    },
    update: {},
    create: {
      provider: "SSLCOMMERZ",
      eventType: "ipn",
      externalEventId: input.val_id,
      payload: input as unknown as object,
      processed: false,
    },
  });

  if (webhookLog.processed) {
    return { alreadyProcessed: true };
  }

  const verification = await sslcommerzProvider.verifyTransaction(input.val_id);

  if (!verification.valid) {
    await prisma.paymentWebhookLog.update({
      where: { id: webhookLog.id },
      data: { processed: true, processedAt: new Date() },
    });

    throw new AppError("Transaction verification failed", 400);
  }

  return transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { providerReference: input.tran_id, deletedAt: null },
    });

    if (!payment) throw new AppError("Payment not found", 404);

    assertAmountMatches(Number(payment.amount), verification.amount);

    const claim = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: { in: ["INITIATED", "PENDING"] },
      },
      data: {
        status: "SUCCESS",
        paidAt: payment.paidAt ?? new Date(),
      },
    });

    if (claim.count === 0) {
      const current = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });

      await tx.paymentWebhookLog.update({
        where: { id: webhookLog.id },
        data: { processed: true, processedAt: new Date() },
      });

      return { payment: toCustomerPayment(current), alreadyProcessed: true };
    }

    const order = await tx.order.findFirst({
      where: { id: payment.orderId, deletedAt: null },
    });

    if (!order) throw new AppError("Order not found", 404);

    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        eventType: "PAYMENT_SUCCESS",
        metadata: {
          source: "sslcommerz-ipn",
          valId: input.val_id,
          verified: true,
        },
      },
    });

    await tx.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        transactionReference: verification.transactionId,
        gatewayResponse: verification.raw as object,
        status: "SUCCESS",
        amount: payment.amount,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAID",
        status: "CONFIRMED",
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: "PAYMENT_RECEIVED",
        metadata: { paymentId: payment.id, source: "sslcommerz-ipn" },
      },
    });

    await tx.paymentWebhookLog.update({
      where: { id: webhookLog.id },
      data: { processed: true, processedAt: new Date() },
    });

    const updated = await tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });

    return { payment: toCustomerPayment(updated), alreadyProcessed: false };
  });
};
