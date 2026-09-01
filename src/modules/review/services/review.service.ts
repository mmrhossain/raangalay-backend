import { prisma, transaction } from "../../../lib/prisma.ts";
import type { Prisma } from "../../../generated/prisma/client.ts";
import { AppError } from "../../../common/errors/AppError.ts";
import type {
  AdminListReviewsQuery,
  CreateReviewInput,
  ListReviewsQuery,
  UpdateReviewInput,
} from "../validators/review.validators.ts";

const publicReviewSelect = {
  id: true,
  rating: true,
  comment: true,
  verifiedPurchase: true,
  createdAt: true,
  updatedAt: true,
  customerProfile: {
    select: { user: { select: { name: true } } },
  },
} as const;

const adminReviewSelect = {
  id: true,
  rating: true,
  comment: true,
  isApproved: true,
  verifiedPurchase: true,
  customerProfileId: true,
  createdAt: true,
  updatedAt: true,
  customerProfile: {
    select: {
      id: true,
      customerCode: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  product: { select: { id: true, name: true, slug: true } },
} as const;

const paginate = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const createReview = async (
  customerProfileId: string,
  productId: string,
  input: CreateReviewInput
) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null, isPublished: true },
    select: { id: true },
  });

  if (!product) throw new AppError("Product not found", 404);

  const existing = await prisma.review.findUnique({
    where: { productId_customerProfileId: { productId, customerProfileId } },
    select: { id: true },
  });

  if (existing) {
    throw new AppError("You have already reviewed this product", 409);
  }

  let verifiedPurchase = false;

  if (input.orderId) {
    const order = await prisma.order.findFirst({
      where: { id: input.orderId, customerProfileId },
      select: {
        id: true,
        status: true,
        items: {
          select: { variant: { select: { productId: true } } },
        },
      },
    });

    if (!order) throw new AppError("Order not found", 404);

    verifiedPurchase =
      order.status === "DELIVERED" &&
      order.items.some((item) => item.variant?.productId === productId);
  }

  return prisma.review.create({
    data: {
      productId,
      customerProfileId,
      rating: input.rating,
      comment: input.comment ?? null,
      images: [],
      isApproved: false,
      verifiedPurchase,
    },
    select: publicReviewSelect,
  });
};

export const listProductReviews = async (
  productId: string,
  query: ListReviewsQuery
) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true },
  });

  if (!product) throw new AppError("Product not found", 404);

  const where: Prisma.ReviewWhereInput = { productId, isApproved: true };

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      select: publicReviewSelect,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.review.count({ where }),
  ]);

  return {
    items,
    pagination: paginate(query.page, query.limit, total),
  };
};

export const updateReview = async (
  customerProfileId: string,
  reviewId: string,
  input: UpdateReviewInput
) => {
  const review = await prisma.review.findFirst({
    where: { id: reviewId, customerProfileId },
    select: { id: true },
  });

  if (!review) throw new AppError("Review not found", 404);

  return prisma.review.update({
    where: { id: reviewId },
    data: {
      ...(input.rating !== undefined && { rating: input.rating }),
      ...(input.comment !== undefined && { comment: input.comment }),
    },
    select: publicReviewSelect,
  });
};

export const deleteReview = async (
  actorCustomerProfileId: string,
  reviewId: string,
  isAdmin: boolean
) => {
  const review = await prisma.review.findFirst({
    where: {
      id: reviewId,
      ...(isAdmin ? {} : { customerProfileId: actorCustomerProfileId }),
    },
    select: { id: true, productId: true },
  });

  if (!review) throw new AppError("Review not found", 404);

  await prisma.review.delete({ where: { id: reviewId } });

  await recalcProductRating(review.productId);

  return { deleted: true };
};

export const adminListReviews = async (query: AdminListReviewsQuery) => {
  const where: Prisma.ReviewWhereInput = {};

  if (query.status === "pending") where.isApproved = false;
  if (query.status === "approved") where.isApproved = true;

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      select: adminReviewSelect,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.review.count({ where }),
  ]);

  return {
    items,
    pagination: paginate(query.page, query.limit, total),
  };
};

export const approveReview = async (reviewId: string) => {
  return transaction(async (tx) => {
    const review = await tx.review.findUnique({ where: { id: reviewId } });

    if (!review) throw new AppError("Review not found", 404);

    if (review.isApproved) {
      throw new AppError("Review is already approved", 400);
    }

    const updated = await tx.review.update({
      where: { id: reviewId },
      data: { isApproved: true },
      select: adminReviewSelect,
    });

    await recalcProductRatingTx(tx, review.productId);

    return updated;
  });
};

const recalcProductRating = async (productId: string) => {
  const agg = await prisma.review.aggregate({
    _avg: { rating: true },
    _count: true,
    where: { productId, isApproved: true },
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      averageRating: agg._avg.rating ?? 0,
      reviewCount: agg._count,
    },
  });
};

const recalcProductRatingTx = async (
  tx: Prisma.TransactionClient,
  productId: string
) => {
  const agg = await tx.review.aggregate({
    _avg: { rating: true },
    _count: true,
    where: { productId, isApproved: true },
  });

  await tx.product.update({
    where: { id: productId },
    data: {
      averageRating: agg._avg.rating ?? 0,
      reviewCount: agg._count,
    },
  });
};
