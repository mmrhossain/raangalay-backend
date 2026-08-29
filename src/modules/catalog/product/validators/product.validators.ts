import { z } from "zod";

export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format");

export const createProductSchema = z.object({
  name: z.string().min(1),
  slug: slugSchema,
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  sku: z.string().optional(),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  categoryId: z.string().min(1),
  brandId: z.string().nullable().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const variantImageSchema = z.object({
  imageUrl: z.string().url(),
  altText: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export const createVariantSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional(),
  price: z.coerce.number().positive(),
  compareAtPrice: z.coerce.number().positive().optional(),
  costPrice: z.coerce.number().positive().optional(),
  weight: z.coerce.number().positive().optional(),
  isDefault: z.boolean().default(false),
  attributeValueIds: z.array(z.string()).optional(),
  images: z.array(variantImageSchema).optional(),
});

export const updateVariantSchema = createVariantSchema.partial();

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  brand: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "popular"]).default("newest"),
  includeInactive: z.coerce.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
