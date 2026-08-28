import { z } from "zod";

export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format");

export const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: slugSchema,
  description: z.string().optional(),
  image: z.string().url().optional(),
  isActive: z.boolean().default(true),
  parentId: z.string().nullable().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createBrandSchema = z.object({
  name: z.string().min(1),
  slug: slugSchema,
  logo: z.string().url().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateBrandSchema = createBrandSchema.partial();

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

export const createInventoryAdjustmentSchema = z.object({
  warehouseId: z.string().min(1),
  variantId: z.string().min(1),
  difference: z.coerce.number().int(),
  reason: z.string().min(1),
});

export const approveInventoryAdjustmentSchema = z.object({
  approved: z.boolean(),
  remarks: z.string().optional(),
});

export const inventoryTransferItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const createInventoryTransferSchema = z.object({
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  remarks: z.string().optional(),
  items: z.array(inventoryTransferItemSchema).min(1),
});

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

export const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  warehouseId: z.string().optional(),
  variantId: z.string().optional(),
  lowStockOnly: z.coerce.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type CreateInventoryAdjustmentInput = z.infer<
  typeof createInventoryAdjustmentSchema
>;
export type CreateInventoryTransferInput = z.infer<
  typeof createInventoryTransferSchema
>;
