import { prisma, transaction } from "../../../lib/prisma.ts";
import { AppError } from "../../../common/errors/AppError.ts";

export const initiatePayment = async (
  customerProfileId: string,
  orderId: string,
  method: "COD"
) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerProfileId, deletedAt: null },
    select: { id: true, orderNumber: true, grandTotal: true },
  });

  if (!order) throw new AppError("Order not found", 404);

  return prisma.payment.create({
    data: {
      orderId: order.id,
      method,
      status: "PENDING",
      amount: order.grandTotal,
    },
  });
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

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAID",
        status: "CONFIRMED",
      },
    });

    return updated;
  });
};
