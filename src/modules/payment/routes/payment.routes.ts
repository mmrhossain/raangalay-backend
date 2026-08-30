import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware.ts";
import { paymentLimiter } from "../../../common/middleware/rate-limit.middleware.ts";
import { initiatePaymentHandler } from "../controllers/payment.controller.ts";

const router = Router();

router.post(
  "/payments/:orderId/initiate",
  paymentLimiter,
  requireAuth,
  initiatePaymentHandler
);

export default router;
