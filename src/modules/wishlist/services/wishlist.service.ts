import { prisma } from "../../../lib/prisma.ts";
import { AppError } from "../../../common/errors/AppError.ts";
import type { ListWishlistQuery } from "../validators/wishlist.validator.ts";

const wishlistItemInclude = {
  variant: {
    select: {
      id: true,
      sku: true,
      price: true,
      compareAtPrice: true,
      isDefault: true,
      images: {
        select: { id: true, imageUrl: true, altText: true, isPrimary: true },
      },
      product: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

const paginate = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const getOrCreateWishlist = async (customerProfileId: string) => {
  const existing = await prisma.wishlist.findUnique({
    where: { customerProfileId },
  });
  if (existing) return existing;

  return prisma.wishlist.create({ data: { customerProfileId } });
};

export const getWishlist = async (customerProfileId: string) => {
  const wishlist = await getOrCreateWishlist(customerProfileId);

  const items = await prisma.wishlistItem.findMany({
    where: { wishlistId: wishlist.id },
    include: wishlistItemInclude,
    orderBy: { createdAt: "desc" },
  });

  return { id: wishlist.id, items };
};

export const listWishlistItems = async (
  customerProfileId: string,
  query: ListWishlistQuery
) => {
  const wishlist = await getOrCreateWishlist(customerProfileId);

  const where = { wishlistId: wishlist.id };

  const [items, total] = await Promise.all([
    prisma.wishlistItem.findMany({
      where,
      include: wishlistItemInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.wishlistItem.count({ where }),
  ]);

  return {
    items,
    pagination: paginate(query.page, query.limit, total),
  };
};

export const addWishlistItem = async (
  customerProfileId: string,
  variantId: string
) => {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, deletedAt: null, product: { deletedAt: null } },
  });

  if (!variant) throw new AppError("Variant not found", 404);

  const wishlist = await getOrCreateWishlist(customerProfileId);

  const item = await prisma.wishlistItem.upsert({
    where: { wishlistId_variantId: { wishlistId: wishlist.id, variantId } },
    update: {},
    create: { wishlistId: wishlist.id, variantId },
    include: wishlistItemInclude,
  });

  return { wishlistId: wishlist.id, item };
};

export const removeWishlistItem = async (
  customerProfileId: string,
  variantId: string
) => {
  const wishlist = await getOrCreateWishlist(customerProfileId);

  const existing = await prisma.wishlistItem.findUnique({
    where: { wishlistId_variantId: { wishlistId: wishlist.id, variantId } },
  });

  if (!existing) throw new AppError("Item not in wishlist", 404);

  await prisma.wishlistItem.delete({
    where: { wishlistId_variantId: { wishlistId: wishlist.id, variantId } },
  });

  return { removed: true };
};

export const clearWishlist = async (customerProfileId: string) => {
  const wishlist = await getOrCreateWishlist(customerProfileId);

  await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });

  return { cleared: true };
};

export const isInWishlist = async (
  customerProfileId: string,
  variantId: string
) => {
  const wishlist = await getOrCreateWishlist(customerProfileId);

  const existing = await prisma.wishlistItem.findUnique({
    where: { wishlistId_variantId: { wishlistId: wishlist.id, variantId } },
    select: { wishlistId: true, variantId: true, createdAt: true },
  });

  return existing;
};
