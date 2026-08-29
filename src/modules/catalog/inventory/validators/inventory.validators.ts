import { z } from "zod";

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

export const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  warehouseId: z.string().optional(),
  variantId: z.string().optional(),
  lowStockOnly: z.coerce.boolean().optional(),
});

export type CreateInventoryAdjustmentInput = z.infer<
  typeof createInventoryAdjustmentSchema
>;
export type CreateInventoryTransferInput = z.infer<
  typeof createInventoryTransferSchema
>;
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;
