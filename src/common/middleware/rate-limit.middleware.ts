import rateLimit from "express-rate-limit";
import { env } from "../../config/env.ts";

export const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const perEndpointLimiter = (windowMs: number, max: number, label: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: `Too many ${label} requests. Please try again later.`,
    },
  });

export const authLimiter = perEndpointLimiter(
  15 * 60 * 1000,
  20,
  "authentication"
);

export const checkoutLimiter = perEndpointLimiter(
  15 * 60 * 1000,
  30,
  "checkout"
);

export const paymentLimiter = perEndpointLimiter(
  15 * 60 * 1000,
  40,
  "payment"
);

export const couponLimiter = perEndpointLimiter(
  15 * 60 * 1000,
  20,
  "coupon"
);

export const reviewLimiter = perEndpointLimiter(
  15 * 60 * 1000,
  20,
  "review submission"
);
