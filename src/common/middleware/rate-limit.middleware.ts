import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { env } from "../../config/env.ts";
import { redis } from "../../lib/redis.ts";

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

export const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  keyGenerator: (req) => req.auth?.user.id ?? req.ip ?? "unknown",
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis!.call(...args),
    prefix: "ai:rl:",
  }),
  message: {
    success: false,
    message: "Too many AI requests. Please try again later.",
  },
});
