import { prisma, transaction } from "../../../../lib/prisma.ts";
import { AppError } from "../../../../common/errors/AppError.ts";
import type {
  CreateProductInput,
  CreateVariantInput,
  ListProductsQuery,
  UpdateProductInput,
  UpdateVariantInput,
} from "../validators/product.validators.ts";

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

export const listProducts = async (query: ListProductsQuery) => {
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
      name: input.name,
      slug: input.slug,
      isPublished: input.isPublished,
      isFeatured: input.isFeatured,
      categoryId: input.categoryId,
      brandId: input.brandId ?? null,
      shortDescription: input.shortDescription ?? null,
      description: input.description ?? null,
      sku: input.sku ?? null,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
    },
  });
};

export const updateProduct = async (id: string, input: UpdateProductInput) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError("Product not found", 404);

  return prisma.product.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.isPublished !== undefined && { isPublished: input.isPublished }),
      ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
      ...(input.categoryId !== undefined && {
        category: { connect: { id: input.categoryId } },
      }),
      ...(input.brandId !== undefined &&
        input.brandId !== null && { brand: { connect: { id: input.brandId } } }),
      ...(input.brandId === null && { brand: { disconnect: true } }),
      ...(input.shortDescription !== undefined && {
        shortDescription: input.shortDescription,
      }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.sku !== undefined && { sku: input.sku }),
      ...(input.metaTitle !== undefined && { metaTitle: input.metaTitle }),
      ...(input.metaDescription !== undefined && {
        metaDescription: input.metaDescription,
      }),
    },
  });
};

export const deleteProduct = async (id: string) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError("Product not found", 404);

  return prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
};

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
        sku: variantData.sku,
        price: variantData.price,
        isDefault: variantData.isDefault,
        productId,
        ...(variantData.barcode !== undefined && { barcode: variantData.barcode }),
        ...(variantData.compareAtPrice !== undefined && {
          compareAtPrice: variantData.compareAtPrice,
        }),
        ...(variantData.costPrice !== undefined && { costPrice: variantData.costPrice }),
        ...(variantData.weight !== undefined && { weight: variantData.weight }),
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
        data: images.map((img) => ({
          imageUrl: img.imageUrl,
          isPrimary: img.isPrimary,
          altText: img.altText ?? null,
          productId,
          variantId: variant.id,
        })),
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
  input: UpdateVariantInput
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
      data: {
        ...(variantData.sku !== undefined && { sku: variantData.sku }),
        ...(variantData.price !== undefined && { price: variantData.price }),
        ...(variantData.isDefault !== undefined && { isDefault: variantData.isDefault }),
        ...(variantData.barcode !== undefined && { barcode: variantData.barcode }),
        ...(variantData.compareAtPrice !== undefined && {
          compareAtPrice: variantData.compareAtPrice,
        }),
        ...(variantData.costPrice !== undefined && { costPrice: variantData.costPrice }),
        ...(variantData.weight !== undefined && { weight: variantData.weight }),
      },
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
