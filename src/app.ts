import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.ts";

import { env } from "./config/env.ts";
import { limiter } from "./common/middleware/rate-limit.middleware.ts";

import { notFoundHandler } from "./common/middleware/not-found.middleware.ts";
import { globalErrorHandler } from "./common/middleware/global-error.middleware.ts";

import authRouter  from "./modules/auth/auth.routes.ts";

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
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
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
app.use("/api/v1", authRouter);

/**
 * 404 Handler
 */
app.use(notFoundHandler);

/**
 * Global Error Handler
 */
app.use(globalErrorHandler);

export default app;