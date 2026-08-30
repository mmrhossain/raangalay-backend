import { z } from "zod";

export const addWishlistItemSchema = z.object({
  variantId: z.string().min(1),
});

export const listWishlistQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AddWishlistItemInput = z.infer<typeof addWishlistItemSchema>;
export type ListWishlistQuery = z.infer<typeof listWishlistQuerySchema>;
