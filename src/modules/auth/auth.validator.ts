import { z } from "zod";

export const vendorApplySchema = z.object({
  shopName: z.string().min(1, "Shop name is required"),
  shopSlug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid shop slug"),
  description: z.string().optional(),
  logo: z.string().url().optional(),
});

export const approveUserSchema = z.object({
  isApproved: z.boolean().default(true),
});

export const adminListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(["CUSTOMER", "ADMIN", "VENDOR"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
});

export type VendorApplyInput = z.infer<typeof vendorApplySchema>;
export type ApproveUserInput = z.infer<typeof approveUserSchema>;
export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;
