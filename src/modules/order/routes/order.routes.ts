import { Router } from "express";
import {
  requireAuth,
  requireRole,
} from "../../../common/middleware/auth.middleware.ts";
import { checkoutLimiter } from "../../../common/middleware/rate-limit.middleware.ts";
import {
  checkoutHandler,
  listMyOrdersHandler,
  getMyOrderHandler,
  cancelOrderHandler,
} from "../controllers/order.controller.ts";

const router = Router();

router.post("/checkout", checkoutLimiter, requireAuth, checkoutHandler);
router.get("/orders", requireAuth, listMyOrdersHandler);
router.get("/orders/:id", requireAuth, getMyOrderHandler);
router.post("/orders/:id/cancel", requireAuth, cancelOrderHandler);

export default router;
