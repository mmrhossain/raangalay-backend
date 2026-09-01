import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { env } from "./config/env.ts";
import { limiter } from "./common/middleware/rate-limit.middleware.ts";

import { notFoundHandler } from "./common/middleware/not-found.middleware.ts";
import { globalErrorHandler } from "./common/middleware/global-error.middleware.ts";
import { toNodeHandler } from "better-auth/node";


import catalogRoutes from "./modules/catalog/index.ts";
import cartRoutes from "./modules/cart/cart.routes.ts";
import orderRoutes from "./modules/order/index.ts";
import paymentRoutes from "./modules/payment/index.ts";
import couponRoutes from "./modules/coupon/coupon.routes.ts";
import wishlistRoutes from "./modules/wishlist/index.ts";
import reviewRoutes from "./modules/review/index.ts";
import {auth} from "./lib/auth.ts";

const app: Application = express();

app.all("/api/v1/auth/*splat", toNodeHandler(auth));

/**
 * Trust Proxy
 * Required for:
 * - Nginx
 * - Cloudflare
 * - Railway
 * - Render
 * - AWS ALB
 */
app.set("trust proxy", 1);

/**
 * Security Headers
 */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

/**
 * Compression
 */
app.use(compression());

/**
 * CORS
 */
app.use(
  cors({
    origin: [env.FRONTEND_URL],
    credentials: true,
  })
);

/**
 * Request Parsers
 */
app.use(
  express.json({
    limit: env.MAX_JSON_SIZE,
  })
);

app.use(
  express.urlencoded({
    extended: env.urlEncoded,
    limit: env.MAX_JSON_SIZE,
  })
);

/**
 * Cookies
 */
app.use(cookieParser());

/**
 * Rate Limiting
 */
app.use(limiter);

/**
 * HTTP Logger
 */
if (env.isDevelopment) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

/**
 * Health Check
 */
app.get("/health", (_, res) => {
  res.status(200).json({
    success: true,
    message: "Server running successfully",
    timestamp: new Date().toISOString(),
  });
});

/**
 * API Routes
 */
app.use("/api/v1", catalogRoutes);
app.use("/api/v1", cartRoutes);
app.use("/api/v1", orderRoutes);
app.use("/api/v1", paymentRoutes);
app.use("/api/v1", couponRoutes);
app.use("/api/v1", wishlistRoutes);
app.use("/api/v1", reviewRoutes);

/**
 * 404 Handler
 */
app.use(notFoundHandler);

/**
 * Global Error Handler
 */
app.use(globalErrorHandler);

export default app;