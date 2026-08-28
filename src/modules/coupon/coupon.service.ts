import { prisma, transaction, type TransactionClient } from "../../lib/prisma.ts";
import { AppError } from "../../common/errors/AppError.ts";
import type { CreateCouponInput } from "./coupon.validator.ts";

export interface CouponContext {
  subtotal: number;
  productIds: string[];
  productCategoryIds: string[];
}

const calculateDiscount = (
  coupon: { discountType: string; discountValue: number; maximumDiscountAmount: number | null },
  subtotal: number
) => {
  switch (coupon.discountType) {
    case "PERCENTAGE": {
      const discount = (subtotal * coupon.discountValue) / 100;
      return coupon.maximumDiscountAmount
        ? Math.min(discount, coupon.maximumDiscountAmount)
        : discount;
    }
    case "FIXED_AMOUNT":
      return Math.min(coupon.discountValue, subtotal);
    case "FREE_SHIPPING":
      return 0;
    default:
      return 0;
  }
};

const checkApplicability = (
  coupon: {
    applicableProductIds: string[];
    applicableCategoryIds: string[];
  },
  ctx: CouponContext
) => {
  if (coupon.applicableProductIds.length > 0) {
    const matches = coupon.applicableProductIds.some((id) =>
      ctx.productIds.includes(id)
    );
    if (!matches) {
      throw new AppError("Coupon is not applicable to the items in the cart", 400);
    }
  }

  if (coupon.applicableCategoryIds.length > 0) {
    const matches = coupon.applicableCategoryIds.some((id) =>
      ctx.productCategoryIds.includes(id)
    );
    if (!matches) {
      throw new AppError("Coupon is not applicable to the items in the cart", 400);
    }
  }
};

export const validateCouponRow = async (
  coupon: {
    id: string;
    code: string;
    isActive: boolean;
    status: string;
    startsAt: Date;
    expiresAt: Date;
    minimumOrderAmount: number | null;
    usageLimit: number | null;
    usageCount: number;
    usageLimitPerCustomer: number | null;
    applicableProductIds: string[];
    applicableCategoryIds: string[];
  },
  customerProfileId: string,
  ctx: CouponContext
) => {
  const now = new Date();

  if (!coupon.isActive || coupon.status !== "ACTIVE") {
    throw new AppError("Coupon is not active", 400);
  }
  if (now < coupon.startsAt || now > coupon.expiresAt) {
    throw new AppError("Coupon is not valid at this time", 400);
  }
  if (coupon.minimumOrderAmount !== null && ctx.subtotal < coupon.minimumOrderAmount) {
    throw new AppError("Order subtotal is below the coupon minimum", 400);
  }
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    throw new AppError("Coupon usage limit has been reached", 400);
  }
  if (coupon.usageLimitPerCustomer !== null) {
    const used = await prisma.couponUsage.count({
      where: { couponId: coupon.id, customerProfileId },
    });
    if (used >= coupon.usageLimitPerCustomer) {
      throw new AppError("Coupon has already been used by this customer", 400);
    }
  }

  checkApplicability(coupon, ctx);

  return calculateDiscount(coupon, ctx.subtotal);
};

export const validateCouponCode = async (
  code: string,
  customerProfileId: string,
  ctx: CouponContext
) => {
  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon || coupon.deletedAt) {
    throw new AppError("Invalid coupon code", 400);
  }

  const discountAmount = await validateCouponRow(coupon, customerProfileId, ctx);

  return { coupon, discountAmount };
};

export const applyCouponAtomic = async (
  code: string,
  customerProfileId: string,
  ctx: CouponContext,
  tx: TransactionClient
) => {
  const rows = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT id FROM "Coupon" WHERE code = ${code} FOR UPDATE`;

  if (!rows[0]) {
    throw new AppError("Invalid coupon code", 400);
  }

  const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: rows[0].id } });

  if (coupon.deletedAt) {
    throw new AppError("Invalid coupon code", 400);
  }

  const now = new Date();

  if (!coupon.isActive || coupon.status !== "ACTIVE") {
    throw new AppError("Coupon is not active", 400);
  }
  if (now < coupon.startsAt || now > coupon.expiresAt) {
    throw new AppError("Coupon is not valid at this time", 400);
  }
  if (coupon.minimumOrderAmount !== null && ctx.subtotal < coupon.minimumOrderAmount) {
    throw new AppError("Order subtotal is below the coupon minimum", 400);
  }
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    throw new AppError("Coupon usage limit has been reached", 400);
  }
  if (coupon.usageLimitPerCustomer !== null) {
    const used = await tx.couponUsage.count({
      where: { couponId: coupon.id, customerProfileId },
    });
    if (used >= coupon.usageLimitPerCustomer) {
      throw new AppError("Coupon has already been used by this customer", 400);
    }
  }

  checkApplicability(coupon, ctx);

  const discountAmount = calculateDiscount(coupon, ctx.subtotal);

  return { coupon, discountAmount };
};

export const listCoupons = async (page: number, limit: number) => {
  const [items, total] = await Promise.all([
    prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.coupon.count(),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const createCoupon = async (input: CreateCouponInput) => {
  if (input.expiresAt <= input.startsAt) {
    throw new AppError("expiresAt must be after startsAt", 400);
  }

  const existing = await prisma.coupon.findUnique({ where: { code: input.code } });
  if (existing) throw new AppError("Coupon code already exists", 409);

  return prisma.coupon.create({ data: input });
};

export const updateCoupon = async (
  id: string,
  input: Partial<CreateCouponInput>
) => {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new AppError("Coupon not found", 404);

  return prisma.coupon.update({ where: { id }, data: input });
};

export const deleteCoupon = async (id: string) => {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new AppError("Coupon not found", 404);

  return prisma.coupon.update({ where: { id }, data: { deletedAt: new Date() } });
};
