import { prisma, transaction, type TransactionClient } from "../../lib/prisma.ts";
import { AppError } from "../../common/errors/AppError.ts";
import type {
  CreateCategoryInput,
  CreateBrandInput,
  CreateProductInput,
  CreateVariantInput,
  CreateInventoryAdjustmentInput,
  CreateInventoryTransferInput,
} from "./catalog.validator.ts";

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

const publicVariantSelect = {
  id: true,
  sku: true,
  barcode: true,
  price: true,
  compareAtPrice: true,
  weight: true,
  isDefault: true,
  images: {
    select: { id: true, imageUrl: true, altText: true, isPrimary: true },
  },
} as const;

// -------------------- Categories --------------------

export const listCategories = async () => {
  return prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      image: true,
      isActive: true,
      parentId: true,
    },
  });
};

export const createCategory = async (input: CreateCategoryInput) => {
  const existing = await prisma.category.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError("Category slug already exists", 409);

  return prisma.category.create({ data: input });
};

export const updateCategory = async (id: string, input: Partial<CreateCategoryInput>) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found", 404);

  if (input.slug && input.slug !== existing.slug) {
    const slugTaken = await prisma.category.findUnique({ where: { slug: input.slug } });
    if (slugTaken) throw new AppError("Category slug already exists", 409);
  }

  return prisma.category.update({ where: { id }, data: input });
};

export const deleteCategory = async (id: string) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found", 404);

  return prisma.category.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

// -------------------- Brands --------------------

export const listBrands = async () => {
  return prisma.brand.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      description: true,
      isActive: true,
    },
  });
};

export const createBrand = async (input: CreateBrandInput) => {
  const existing = await prisma.brand.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError("Brand slug already exists", 409);

  return prisma.brand.create({ data: input });
};

export const updateBrand = async (id: string, input: Partial<CreateBrandInput>) => {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new AppError("Brand not found", 404);

  return prisma.brand.update({ where: { id }, data: input });
};

export const deleteBrand = async (id: string) => {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new AppError("Brand not found", 404);

  return prisma.brand.update({ where: { id }, data: { deletedAt: new Date() } });
};

// -------------------- Products --------------------

export const listProducts = async (query: {
  page: number;
  limit: number;
  category?: string;
  brand?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: string;
  includeInactive?: boolean;
}) => {
  const where: Record<string, unknown> = {
    deletedAt: null,
    ...(query.includeInactive ? {} : { isPublished: true }),
  };

  if (query.category) {
    where.category = { slug: query.category, deletedAt: null };
  }
  if (query.brand) {
    where.brand = { slug: query.brand, deletedAt: null };
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { slug: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.variants = {
      some: {
        deletedAt: null,
        ...(query.minPrice !== undefined && { price: { gte: query.minPrice } }),
        ...(query.maxPrice !== undefined && { price: { lte: query.maxPrice } }),
      },
    };
  }

  const orderBy =
    query.sort === "price_asc"
      ? { variants: { _count: "asc" as const } }
      : query.sort === "price_desc"
        ? { variants: { _count: "desc" as const } }
        : { createdAt: "desc" as const };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        isFeatured: true,
        averageRating: true,
        reviewCount: true,
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        images: {
          where: { isPrimary: true },
          select: { imageUrl: true },
          take: 1,
        },
        variants: {
          where: { deletedAt: null },
          select: { id: true, price: true, compareAtPrice: true },
          orderBy: { isDefault: "desc" as const },
        },
      },
    }),
    prisma.product.count({ where }),
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

export const getProductBySlug = async (slug: string, admin = false) => {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      deletedAt: null,
      ...(admin ? {} : { isPublished: true }),
    },
    include: {
      category: true,
      brand: true,
      variants: {
        where: { deletedAt: null },
        orderBy: { isDefault: "desc" },
        select: {
          ...publicVariantSelect,
          inventories: {
            select: { quantityAvailable: true },
          },
        },
      },
      images: {
        select: { id: true, imageUrl: true, altText: true, isPrimary: true },
      },
    },
  });

  if (!product) throw new AppError("Product not found", 404);

  const variants = product.variants.map((v) => {
    const { inventories, ...rest } = v;
    const availableStock = inventories.reduce(
      (sum, inv) => sum + inv.quantityAvailable,
      0
    );
    return { ...rest, availableStock };
  });

  return { ...product, variants };
};

export const createProduct = async (input: CreateProductInput) => {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
  });
  if (!category || category.deletedAt) {
    throw new AppError("Category not found", 404);
  }

  const existing = await prisma.product.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError("Product slug already exists", 409);

  return prisma.product.create({
    data: {
      ...input,
      brandId: input.brandId ?? null,
    },
  });
};

export const updateProduct = async (id: string, input: Partial<CreateProductInput>) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError("Product not found", 404);

  return prisma.product.update({ where: { id }, data: input });
};

export const deleteProduct = async (id: string) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError("Product not found", 404);

  return prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
};

// -------------------- Variants --------------------

export const createVariant = async (productId: string, input: CreateVariantInput) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError("Product not found", 404);

  const existingSku = await prisma.productVariant.findUnique({ where: { sku: input.sku } });
  if (existingSku) throw new AppError("Variant SKU already exists", 409);

  if (input.barcode) {
    const existingBarcode = await prisma.productVariant.findUnique({
      where: { barcode: input.barcode },
    });
    if (existingBarcode) throw new AppError("Variant barcode already exists", 409);
  }

  const { attributeValueIds, images, ...variantData } = input;

  return transaction(async (tx) => {
    const variant = await tx.productVariant.create({
      data: {
        ...variantData,
        productId,
      },
    });

    if (attributeValueIds?.length) {
      const values = await tx.attributeValue.findMany({
        where: { id: { in: attributeValueIds } },
      });
      if (values.length !== attributeValueIds.length) {
        throw new AppError("One or more attribute values not found", 400);
      }

      await tx.variantAttribute.createMany({
        data: attributeValueIds.map((attributeValueId) => ({
          variantId: variant.id,
          attributeValueId,
        })),
      });
    }

    if (images?.length) {
      await tx.productImage.createMany({
        data: images.map((img) => ({ ...img, productId, variantId: variant.id })),
      });
    }

    return tx.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
      include: { images: true, attributes: { include: { attributeValue: true } } },
    });
  });
};

export const updateVariant = async (
  id: string,
  input: Partial<CreateVariantInput>
) => {
  const existing = await prisma.productVariant.findUnique({ where: { id } });
  if (!existing) throw new AppError("Variant not found", 404);

  if (input.sku && input.sku !== existing.sku) {
    const skuTaken = await prisma.productVariant.findUnique({
      where: { sku: input.sku },
    });
    if (skuTaken) throw new AppError("Variant SKU already exists", 409);
  }

  if (input.barcode && input.barcode !== existing.barcode) {
    const barcodeTaken = await prisma.productVariant.findUnique({
      where: { barcode: input.barcode },
    });
    if (barcodeTaken) throw new AppError("Variant barcode already exists", 409);
  }

  const { attributeValueIds, images, ...variantData } = input;

  return transaction(async (tx) => {
    const variant = await tx.productVariant.update({
      where: { id },
      data: variantData,
    });

    if (attributeValueIds) {
      await tx.variantAttribute.deleteMany({ where: { variantId: id } });
      await tx.variantAttribute.createMany({
        data: attributeValueIds.map((attributeValueId) => ({
          variantId: id,
          attributeValueId,
        })),
      });
    }

    return variant;
  });
};

export const deleteVariant = async (id: string) => {
  const existing = await prisma.productVariant.findUnique({ where: { id } });
  if (!existing) throw new AppError("Variant not found", 404);

  return prisma.productVariant.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

// -------------------- Inventory --------------------

export const listInventory = async (query: {
  page: number;
  limit: number;
  warehouseId?: string;
  variantId?: string;
  lowStockOnly?: boolean;
}) => {
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
        remarks: input.remarks,
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
