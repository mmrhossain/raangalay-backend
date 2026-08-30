import { randomUUID } from "node:crypto";
import { prisma, transaction } from "../../../lib/prisma.ts";
import { AppError } from "../../../common/errors/AppError.ts";
import type { PaymentMethod } from "../../../generated/prisma/enums.ts";
import type { Prisma } from "../../../generated/prisma/client.ts";
import { getPaymentProvider } from "../providers/index.ts";
import { getCallbackUrls } from "../providers/sslcommerz.provider.ts";
import type { ProviderOrderData } from "../providers/payment.provider.ts";
import type { RefundInput } from "../validators/payment.validators.ts";

const toProviderOrder = (order: {
  id: string;
  orderNumber: string;
  grandTotal: Prisma.Decimal;
  currency: string;
  billingAddress: {
    fullName: string;
    phone: string;
    email: string | null;
    country: string;
    state: string | null;
    city: string;
    postalCode: string | null;
    addressLine1: string;
  } | null;
  shippingAddress: {
    fullName: string;
    phone: string;
    email: string | null;
    country: string;
    state: string | null;
    city: string;
    postalCode: string | null;
    addressLine1: string;
  } | null;
  customerProfile: {
    user: { name: string; email: string };
  };
}): ProviderOrderData => {
  const address = order.shippingAddress ?? order.billingAddress;
  const user = order.customerProfile.user;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    grandTotal: Number(order.grandTotal),
    currency: order.currency,
    customerName: address?.fullName ?? user.name,
    customerEmail: address?.email ?? user.email,
    customerPhone: address?.phone ?? "",
    customerAddress: address?.addressLine1 ?? undefined,
    customerCity: address?.city ?? undefined,
    customerPostCode: address?.postalCode ?? undefined,
    customerCountry: address?.country ?? undefined,
    customerState: address?.state ?? undefined,
  };
};

export const initiatePayment = async (
  customerProfileId: string,
  orderId: string,
  method: PaymentMethod
) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerProfileId, deletedAt: null },
    include: {
      billingAddress: true,
      shippingAddress: true,
      customerProfile: {
        select: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!order) throw new AppError("Order not found", 404);

  const provider = getPaymentProvider(method);
  const providerOrder = toProviderOrder(order);
  const callbacks = getCallbackUrls();

  if (method === "SSLCOMMERZ") {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    providerOrder.orderNumber = `${providerOrder.orderNumber}-${suffix}`;
  }

  const initiateResult = await provider.initiate(providerOrder, callbacks);

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      method,
      status: initiateResult.paymentStatus,
      amount: Number(order.grandTotal),
      provider: method,
      ...(initiateResult.providerReference && {
        providerReference: initiateResult.providerReference,
      }),
      ...(initiateResult.expiresAt && { expiresAt: initiateResult.expiresAt }),
    },
  });

  await prisma.paymentEvent.create({
    data: {
      paymentId: payment.id,
      eventType: "PAYMENT_CREATED",
      metadata: { method, initiatedBy: customerProfileId },
    },
  });

  return {
    payment: {
      id: payment.id,
      method: payment.method,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      createdAt: payment.createdAt,
    },
    checkoutUrl: initiateResult.checkoutUrl,
  };
};

export const collectCodPayment = async (paymentId: string, actorId: string) => {
  return transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
    });

    if (!payment) throw new AppError("Payment not found", 404);
    if (payment.method !== "COD") throw new AppError("Not a COD payment", 400);
    if (payment.status !== "PENDING") {
      throw new AppError("Payment already processed", 409);
    }

    const order = await tx.order.findFirst({
      where: { id: payment.orderId, deletedAt: null },
    });

    if (!order) throw new AppError("Order not found", 404);

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "COLLECTED",
        paidAt: new Date(),
      },
      include: { order: true },
    });

    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        eventType: "PAYMENT_SUCCESS",
        metadata: { source: "cod-collect", collectedBy: actorId },
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
        metadata: { paymentId: payment.id, source: "cod-collect" },
      },
    });

    return updated;
  });
};

export const createRefund = async (
  paymentId: string,
  input: RefundInput,
  actorId: string
) => {
  return transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
    });

    if (!payment) throw new AppError("Payment not found", 404);

    if (
      payment.status === "PENDING" ||
      payment.status === "INITIATED" ||
      payment.status === "FAILED" ||
      payment.status === "CANCELLED"
    ) {
      throw new AppError("Payment is not in a refundable state", 400);
    }

    const refunds = await tx.refund.findMany({
      where: { paymentId: payment.id },
    });

    const refundedTotal = refunds.reduce(
      (sum, refund) => sum + Number(refund.amount),
      0
    );

    if (refundedTotal + input.amount > Number(payment.amount)) {
      throw new AppError(
        "Refund amount exceeds the payment amount",
        400
      );
    }

    const refund = await tx.refund.create({
      data: {
        paymentId: payment.id,
        amount: input.amount,
        reason: input.reason ?? null,
        status: "PENDING",
      },
    });

    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        eventType: "REFUND_CREATED",
        metadata: {
          refundId: refund.id,
          amount: input.amount,
          initiatedBy: actorId,
        },
      },
    });

    return refund;
  });
};
