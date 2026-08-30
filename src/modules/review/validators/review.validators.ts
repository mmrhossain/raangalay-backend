import { z } from "zod";

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  orderId: z.string().min(1).optional(),
});

export const updateReviewSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    comment: z.string().max(2000).optional(),
  })
  .refine((d) => d.rating !== undefined || d.comment !== undefined, {
    message: "Provide at least one field to update",
  });

export const listReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const adminListReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "approved"]).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;
export type AdminListReviewsQuery = z.infer<typeof adminListReviewsQuerySchema>;
