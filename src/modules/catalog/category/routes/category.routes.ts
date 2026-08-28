import { Router } from "express";
import {
  requireAuth,
  requireRole,
  requireApproval,
} from "../../../../common/middleware/auth.middleware.ts";
import {
  getCategories,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} from "../controllers/category.controller.ts";

const router = Router();

// Public catalog
router.get("/categories", getCategories);

const adminAndVendor = [
  requireAuth,
  requireRole("ADMIN", "VENDOR"),
  requireApproval,
];

// Admin: categories
router.post("/admin/categories", ...adminAndVendor, createCategoryHandler);
router.put("/admin/categories/:id", ...adminAndVendor, updateCategoryHandler);
router.delete("/admin/categories/:id", ...adminAndVendor, deleteCategoryHandler);

export default router;
