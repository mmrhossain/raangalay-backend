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

const app: Application = express();

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
// app.use("/api/v1", );

/**
 * 404 Handler
 */
app.use(notFoundHandler);

/**
 * Global Error Handler
 */
app.use(globalErrorHandler);

export default app;