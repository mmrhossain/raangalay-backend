import { Router } from "express";
import {
  requireAuth,
  requireRole,
} from "../../../common/middleware/auth.middleware.ts";
import {
  collectCodPaymentHandler,
  refundPaymentHandler,
} from "../controllers/payment.controller.ts";

const router = Router();

const adminOnly = [requireAuth, requireRole("ADMIN")];

router.post(
  "/admin/payments/cod/:paymentId/collect",
  ...adminOnly,
  collectCodPaymentHandler
);

router.post(
  "/admin/payments/:paymentId/refund",
  ...adminOnly,
  refundPaymentHandler
);

export default router;
