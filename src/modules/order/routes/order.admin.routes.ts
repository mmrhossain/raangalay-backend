import { Router } from "express";
import {
  requireAuth,
  requireRole,
} from "../../../common/middleware/auth.middleware.ts";
import {
  adminListOrdersHandler,
  adminGetOrderHandler,
  adminUpdateOrderStatusHandler,
} from "../controllers/order.controller.ts";

const router = Router();

const adminOnly = [requireAuth, requireRole("ADMIN")];

router.get("/admin/orders", ...adminOnly, adminListOrdersHandler);
router.get("/admin/orders/:id", ...adminOnly, adminGetOrderHandler);
router.patch("/admin/orders/:id/status", ...adminOnly, adminUpdateOrderStatusHandler);

export default router;
