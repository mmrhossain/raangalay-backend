import { z } from "zod";

export const createCouponSchema = z.object({
  code: z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "EXPIRED", "DISABLED"]).default("ACTIVE"),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
  discountValue: z.coerce.number().nonnegative(),
  minimumOrderAmount: z.coerce.number().nonnegative().optional(),
  maximumDiscountAmount: z.coerce.number().nonnegative().optional(),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  usageLimitPerCustomer: z.coerce.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  isActive: z.boolean().default(true),
  applicableProductIds: z.array(z.string()).default([]),
  applicableCategoryIds: z.array(z.string()).default([]),
});

export const updateCouponSchema = createCouponSchema.partial();

export const validateCouponSchema = z.object({
  code: z.string().min(1),
});

export const listCouponsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
