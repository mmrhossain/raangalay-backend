import { Router } from "express";
import {
  requireAuth,
  requireRole,
  requireApproval,
} from "../../common/middleware/auth.middleware.ts";
import {
  getCategories,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
  getBrands,
  createBrandHandler,
  updateBrandHandler,
  deleteBrandHandler,
  getProducts,
  getProduct,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
  createVariantHandler,
  updateVariantHandler,
  deleteVariantHandler,
  getInventory,
  createAdjustmentHandler,
  approveAdjustmentHandler,
  getAdjustments,
  createTransferHandler,
  completeTransferHandler,
  getTransfers,
} from "./catalog.controller.ts";

const router = Router();

// Public catalog
router.get("/categories", getCategories);
router.get("/brands", getBrands);
router.get("/products", getProducts);
router.get("/products/:slug", getProduct);

const adminAndVendor = [
  requireAuth,
  requireRole("ADMIN", "VENDOR"),
  requireApproval,
];

const adminOnly = [requireAuth, requireRole("ADMIN")];

// Admin: categories
router.post("/admin/categories", ...adminAndVendor, createCategoryHandler);
router.put("/admin/categories/:id", ...adminAndVendor, updateCategoryHandler);
router.delete("/admin/categories/:id", ...adminAndVendor, deleteCategoryHandler);

// Admin: brands
router.post("/admin/brands", ...adminAndVendor, createBrandHandler);
router.put("/admin/brands/:id", ...adminAndVendor, updateBrandHandler);
router.delete("/admin/brands/:id", ...adminAndVendor, deleteBrandHandler);

// Admin: products & variants
router.post("/admin/products", ...adminAndVendor, createProductHandler);
router.put("/admin/products/:id", ...adminAndVendor, updateProductHandler);
router.delete("/admin/products/:id", ...adminAndVendor, deleteProductHandler);
router.post(
  "/admin/products/:productId/variants",
  ...adminAndVendor,
  createVariantHandler
);
router.put("/admin/variants/:id", ...adminAndVendor, updateVariantHandler);
router.delete("/admin/variants/:id", ...adminAndVendor, deleteVariantHandler);

// Admin: inventory
router.get("/admin/inventory", ...adminOnly, getInventory);
router.get("/admin/inventory/adjustments", ...adminOnly, getAdjustments);
router.post("/admin/inventory/adjustments", ...adminOnly, createAdjustmentHandler);
router.post(
  "/admin/inventory/adjustments/:id/approve",
  ...adminOnly,
  approveAdjustmentHandler
);
router.get("/admin/inventory/transfers", ...adminOnly, getTransfers);
router.post("/admin/inventory/transfers", ...adminOnly, createTransferHandler);
router.post(
  "/admin/inventory/transfers/:id/complete",
  ...adminOnly,
  completeTransferHandler
);

export default router;
