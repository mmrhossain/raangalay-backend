import { z } from "zod";

export const addItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(999),
});

export const updateItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(999),
});

export const applyCouponSchema = z.object({
  code: z.string().min(1).max(100),
});

export const guestCartSchema = z.object({
  sessionId: z.string().min(1).max(255),
  cartData: z.unknown().optional(),
});

export const mergeGuestCartSchema = z.object({
  sessionId: z.string().min(1).max(255),
});

const addressSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  country: z.string().min(1),
  state: z.string().optional(),
  city: z.string().min(1),
  area: z.string().optional(),
  postalCode: z.string().optional(),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
});

export const checkoutSchema = z.object({
  paymentMethod: z.enum(["COD", "SSLCOMMERZ"]),
  billingAddress: addressSchema,
  shippingAddress: addressSchema.optional(),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
});

export type AddItemInput = z.infer<typeof addItemSchema>;
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
