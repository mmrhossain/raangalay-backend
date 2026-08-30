import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware.ts";
import { paymentLimiter } from "../../../common/middleware/rate-limit.middleware.ts";
import {
  initiatePaymentHandler,
  sslcommerzCancelHandler,
  sslcommerzFailHandler,
  sslcommerzIpnHandler,
  sslcommerzSuccessHandler,
} from "../controllers/payment.controller.ts";

const router = Router();

router.post(
  "/payments/:orderId/initiate",
  paymentLimiter,
  requireAuth,
  initiatePaymentHandler
);

router.post("/payments/sslcommerz/success", sslcommerzSuccessHandler);
router.post("/payments/sslcommerz/fail", sslcommerzFailHandler);
router.post("/payments/sslcommerz/cancel", sslcommerzCancelHandler);
router.post("/payments/sslcommerz/ipn", sslcommerzIpnHandler);

export default router;
