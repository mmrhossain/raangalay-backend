import { Router } from "express";
import {
  requireAuth,
  requireRole,
  requireApproval,
} from "../../../../common/middleware/auth.middleware.ts";
import {
  getBrands,
  createBrandHandler,
  updateBrandHandler,
  deleteBrandHandler,
} from "../controllers/brand.controller.ts";

const router = Router();

// Public catalog
router.get("/brands", getBrands);

const adminAndVendor = [
  requireAuth,
  requireRole("ADMIN", "VENDOR"),
  requireApproval,
];

// Admin: brands
router.post("/admin/brands", ...adminAndVendor, createBrandHandler);
router.put("/admin/brands/:id", ...adminAndVendor, updateBrandHandler);
router.delete("/admin/brands/:id", ...adminAndVendor, deleteBrandHandler);

export default router;
