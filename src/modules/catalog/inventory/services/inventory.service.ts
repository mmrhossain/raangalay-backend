import { prisma, transaction, type TransactionClient } from "../../../../lib/prisma.ts";
import { AppError } from "../../../../common/errors/AppError.ts";
import type {
  CreateInventoryAdjustmentInput,
  CreateInventoryTransferInput,
  ListInventoryQuery,
} from "../validators/inventory.validators.ts";

export const getDefaultWarehouse = async (tx?: TransactionClient) => {
  const db = tx ?? prisma;

  const warehouse = await db.warehouse.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return warehouse;
};

export const lockInventory = async (
  tx: TransactionClient,
  variantId: string,
  warehouseId: string
) => {
  const rows = await tx.$queryRaw<
    Array<{ id: string; quantityAvailable: number }>
  >`SELECT id, "quantityAvailable" FROM "Inventory" WHERE "variantId" = ${variantId} AND "warehouseId" = ${warehouseId} FOR UPDATE`;

  return rows[0] ?? null;
};

export const listInventory = async (query: ListInventoryQuery) => {
  const where: Record<string, unknown> = {
    ...(query.warehouseId && { warehouseId: query.warehouseId }),
    ...(query.variantId && { variantId: query.variantId }),
    ...(query.lowStockOnly && { quantityAvailable: { lt: 10 } }),
  };

  const [items, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            product: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.inventory.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const createInventoryAdjustment = async (
  input: CreateInventoryAdjustmentInput,
  createdBy: string
) => {
  const inventory = await prisma.inventory.findUnique({
    where: {
      warehouseId_variantId: {
        warehouseId: input.warehouseId,
        variantId: input.variantId,
      },
    },
  });

  if (!inventory) {
    throw new AppError(
      "No inventory record exists for this variant in the warehouse",
      400
    );
  }

  return prisma.inventoryAdjustment.create({
    data: {
      warehouseId: input.warehouseId,
      variantId: input.variantId,
      previousQuantity: inventory.quantityOnHand,
      adjustedQuantity: inventory.quantityOnHand + input.difference,
      difference: input.difference,
      reason: input.reason,
      status: "PENDING",
      createdBy,
    },
  });
};

export const approveInventoryAdjustment = async (
  adjustmentId: string,
  approved: boolean,
  approvedBy: string
) => {
  return transaction(async (tx) => {
    const adjustment = await tx.inventoryAdjustment.findUnique({
      where: { id: adjustmentId },
    });

    if (!adjustment) throw new AppError("Adjustment not found", 404);
    if (adjustment.status !== "PENDING") {
      throw new AppError("Adjustment already processed", 400);
    }

    if (!approved) {
      return tx.inventoryAdjustment.update({
        where: { id: adjustmentId },
        data: { status: "REJECTED", approvedBy },
      });
    }

    const invRow = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "Inventory" WHERE "variantId" = ${adjustment.variantId} AND "warehouseId" = ${adjustment.warehouseId} FOR UPDATE`;

    if (!invRow[0]) throw new AppError("Inventory record not found", 404);

    const inventory = await tx.inventory.update({
      where: { id: invRow[0].id },
      data: {
        quantityOnHand: { increment: adjustment.difference },
        quantityAvailable: { increment: adjustment.difference },
        lastTransactionAt: new Date(),
      },
    });

    await tx.inventoryTransaction.create({
      data: {
        inventoryId: inventory.id,
        variantId: adjustment.variantId,
        warehouseId: adjustment.warehouseId,
        type: adjustment.difference >= 0 ? "ADJUSTMENT_INCREASE" : "ADJUSTMENT_DECREASE",
        quantity: Math.abs(adjustment.difference),
        referenceType: "INVENTORY_ADJUSTMENT",
        referenceId: adjustment.id,
        remarks: adjustment.reason,
        createdBy: approvedBy,
      },
    });

    if (inventory.quantityAvailable < 10) {
      await tx.inventoryEvent.create({
        data: {
          warehouseId: adjustment.warehouseId,
          variantId: adjustment.variantId,
          eventType: inventory.quantityAvailable <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
          metadata: { quantityAvailable: inventory.quantityAvailable },
        },
      });
    }

    return tx.inventoryAdjustment.update({
      where: { id: adjustmentId },
      data: { status: "APPROVED", approvedBy },
    });
  });
};

export const createInventoryTransfer = async (
  input: CreateInventoryTransferInput,
  createdBy: string
) => {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new AppError("Source and destination warehouse must differ", 400);
  }

  return transaction(async (tx) => {
    for (const item of input.items) {
      const invRow = await lockInventory(tx, item.variantId, input.fromWarehouseId);

      if (!invRow) {
        throw new AppError(
          `No inventory record for variant ${item.variantId} in source warehouse`,
          400
        );
      }

      const inventory = await tx.inventory.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId: input.fromWarehouseId,
            variantId: item.variantId,
          },
        },
      });

      if (!inventory || inventory.quantityAvailable < item.quantity) {
        throw new AppError(
          `Insufficient available stock for variant ${item.variantId}`,
          409
        );
      }
    }

    const transfer = await tx.inventoryTransfer.create({
      data: {
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        remarks: input.remarks ?? null,
        items: {
          create: input.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        },
      },
    });

    await tx.inventoryEvent.create({
      data: {
        warehouseId: input.fromWarehouseId,
        variantId: input.items[0]!.variantId,
        eventType: "STOCK_TRANSFERRED",
        metadata: { transferId: transfer.id, createdBy },
      },
    });

    return transfer;
  });
};

export const completeInventoryTransfer = async (transferId: string, actor: string) => {
  return transaction(async (tx) => {
    const transfer = await tx.inventoryTransfer.findUnique({
      where: { id: transferId },
      include: { items: true },
    });

    if (!transfer) throw new AppError("Transfer not found", 404);
    if (transfer.status !== "PENDING") {
      throw new AppError("Transfer already processed", 400);
    }

    for (const item of transfer.items) {
      const fromRow = await lockInventory(tx, item.variantId, transfer.fromWarehouseId);

      if (!fromRow) {
        throw new AppError(
          `No inventory record for variant ${item.variantId} in source warehouse`,
          400
        );
      }

      const fromInventory = await tx.inventory.findUniqueOrThrow({
        where: {
          warehouseId_variantId: {
            warehouseId: transfer.fromWarehouseId,
            variantId: item.variantId,
          },
        },
      });

      if (fromInventory.quantityAvailable < item.quantity) {
        throw new AppError(
          `Insufficient available stock for variant ${item.variantId}`,
          409
        );
      }

      await tx.inventory.update({
        where: { id: fromInventory.id },
        data: {
          quantityOnHand: { decrement: item.quantity },
          quantityAvailable: { decrement: item.quantity },
          lastTransactionAt: new Date(),
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: fromInventory.id,
          variantId: item.variantId,
          warehouseId: transfer.fromWarehouseId,
          type: "TRANSFER_OUT",
          quantity: item.quantity,
          referenceType: "INVENTORY_TRANSFER",
          referenceId: transferId,
          createdBy: actor,
        },
      });

      const toInventory = await tx.inventory.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId: transfer.toWarehouseId,
            variantId: item.variantId,
          },
        },
      });

      if (toInventory) {
        await tx.inventory.update({
          where: { id: toInventory.id },
          data: {
            quantityOnHand: { increment: item.quantity },
            quantityAvailable: { increment: item.quantity },
            lastTransactionAt: new Date(),
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            inventoryId: toInventory.id,
            variantId: item.variantId,
            warehouseId: transfer.toWarehouseId,
            type: "TRANSFER_IN",
            quantity: item.quantity,
            referenceType: "INVENTORY_TRANSFER",
            referenceId: transferId,
            createdBy: actor,
          },
        });
      } else {
        await tx.inventory.create({
          data: {
            warehouseId: transfer.toWarehouseId,
            variantId: item.variantId,
            quantityOnHand: item.quantity,
            quantityReserved: 0,
            quantityAvailable: item.quantity,
          },
        });
      }
    }

    return tx.inventoryTransfer.update({
      where: { id: transferId },
      data: { status: "COMPLETED" },
    });
  });
};

export const listInventoryAdjustments = async (page: number, limit: number) => {
  const [items, total] = await Promise.all([
    prisma.inventoryAdjustment.findMany({
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        variant: { select: { id: true, sku: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.inventoryAdjustment.count(),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const listInventoryTransfers = async (page: number, limit: number) => {
  const [items, total] = await Promise.all([
    prisma.inventoryTransfer.findMany({
      include: {
        items: {
          include: {
            variant: { select: { id: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.inventoryTransfer.count(),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};
