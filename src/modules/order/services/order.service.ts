import { prisma, transaction } from "../../../lib/prisma.ts";
import type { Prisma } from "../../../generated/prisma/client.ts";
import type { OrderEventType, OrderStatus } from "../../../generated/prisma/enums.ts";
import { AppError } from "../../../common/errors/AppError.ts";
import { lockInventory } from "../../catalog/inventory/services/inventory.service.ts";
import type {
  ListOrdersQuery,
  UpdateOrderStatusInput,
} from "../validators/order.validators.ts";

const orderDetailInclude = {
  items: true,
  billingAddress: true,
  shippingAddress: true,
  statusHistory: { orderBy: { createdAt: "asc" as const } },
  events: { orderBy: { createdAt: "asc" as const } },
  payments: {
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      createdAt: true,
    },
  },
} as const;

const paginate = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const listMyOrders = async (
  customerProfileId: string,
  query: ListOrdersQuery
) => {
  const where: Prisma.OrderWhereInput = { customerProfileId, deletedAt: null };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items,
    pagination: paginate(query.page, query.limit, total),
  };
};

export const getMyOrder = async (
  customerProfileId: string,
  orderId: string
) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerProfileId, deletedAt: null },
    include: orderDetailInclude,
  });

  if (!order) throw new AppError("Order not found", 404);

  return order;
};

export const listOrders = async (query: ListOrdersQuery) => {
  const where: Prisma.OrderWhereInput = { deletedAt: null };

  if (query.status) {
    where.status = query.status;
  }

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from && { gte: new Date(query.from) }),
      ...(query.to && { lte: new Date(query.to) }),
    };
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
        customerProfile: {
          select: {
            id: true,
            customerCode: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items,
    pagination: paginate(query.page, query.limit, total),
  };
};

export const getOrder = async (orderId: string) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    include: {
      ...orderDetailInclude,
      customerProfile: {
        select: {
          id: true,
          customerCode: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  if (!order) throw new AppError("Order not found", 404);

  return order;
};

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "SHIPPED", "CANCELLED"],
  PACKED: ["SHIPPED"],
  SHIPPED: ["DELIVERED", "RETURN_REQUESTED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURNED", "REFUNDED", "CANCELLED"],
  RETURNED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

const STATUS_EVENTS: Partial<Record<OrderStatus, OrderEventType>> = {
  CONFIRMED: "ORDER_CONFIRMED",
  PACKED: "ORDER_PACKED",
  SHIPPED: "ORDER_SHIPPED",
  DELIVERED: "ORDER_DELIVERED",
  CANCELLED: "ORDER_CANCELLED",
  RETURN_REQUESTED: "RETURN_REQUESTED",
  RETURNED: "RETURN_APPROVED",
  REFUNDED: "REFUND_COMPLETED",
};

export const updateOrderStatus = async (
  orderId: string,
  input: UpdateOrderStatusInput,
  actorId: string
) => {
  return transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, deletedAt: null },
    });

    if (!order) throw new AppError("Order not found", 404);

    if (!ALLOWED_TRANSITIONS[order.status].includes(input.status)) {
      throw new AppError(
        `Invalid status transition from ${order.status} to ${input.status}`,
        400
      );
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: input.status },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: "desc" } },
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: input.status,
        remarks: input.remarks ?? null,
        changedBy: actorId,
      },
    });

    const eventType = STATUS_EVENTS[input.status];
    if (eventType) {
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType,
          metadata: { fromStatus: order.status, changedBy: actorId },
        },
      });
    }

    return updated;
  });
};

export const cancelOrder = async (
  customerProfileId: string,
  orderId: string,
  reason?: string
) => {
  return transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, customerProfileId, deletedAt: null },
    });

    if (!order) throw new AppError("Order not found", 404);

    if (order.status !== "PENDING" && order.status !== "CONFIRMED") {
      throw new AppError(
        "Order can only be cancelled in PENDING or CONFIRMED status",
        400
      );
    }

    const reservations = await tx.stockReservation.findMany({
      where: { orderId: order.id },
    });

    for (const reservation of reservations) {
      const invRow = await lockInventory(
        tx,
        reservation.variantId,
        reservation.warehouseId
      );

      if (!invRow) continue;

      const inventory = await tx.inventory.findUniqueOrThrow({
        where: { id: invRow.id },
      });

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantityReserved: { decrement: reservation.quantity },
          quantityAvailable: { increment: reservation.quantity },
          lastTransactionAt: new Date(),
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          variantId: reservation.variantId,
          warehouseId: reservation.warehouseId,
          type: "RELEASE",
          quantity: reservation.quantity,
          referenceType: "ORDER",
          referenceId: order.orderNumber,
          remarks: "Order cancelled, stock released",
          createdBy: customerProfileId,
        },
      });
    }

    await tx.stockReservation.deleteMany({ where: { orderId: order.id } });

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: "desc" } },
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: "CANCELLED",
        remarks: reason ?? "Cancelled by customer",
        changedBy: customerProfileId,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: "ORDER_CANCELLED",
        metadata: {
          reason: reason ?? null,
          cancelledBy: customerProfileId,
        },
      },
    });

    return updated;
  });
};
