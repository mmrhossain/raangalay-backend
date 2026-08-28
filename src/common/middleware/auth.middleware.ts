import type { Request, Response, NextFunction } from "express";
import type { IncomingHttpHeaders } from "node:http";
import { auth } from "../../lib/auth.ts";
import { AppError } from "../errors/AppError.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";

type AuthRole = "CUSTOMER" | "ADMIN" | "VENDOR";

const toHeaders = (headers: IncomingHttpHeaders): Headers => {
  const h = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const v of value) h.append(key, v);
    } else {
      h.append(key, value);
    }
  }

  return h;
};

export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({
      headers: toHeaders(req.headers),
    });

    if (!session) {
      throw new AppError("Unauthorized: authentication required", 401);
    }

    req.auth = session;
    next();
  }
);

export const optionalAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({
      headers: toHeaders(req.headers),
    });
    req.auth = session;
    next();
  }
);

export const requireRole =
  (...roles: AuthRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const role = req.auth?.user.role;

    if (!role || !roles.includes(role as AuthRole)) {
      throw new AppError("Forbidden: insufficient permissions", 403);
    }

    next();
  };

export const requireApproval = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (req.auth?.user.role === "VENDOR" && !req.auth.user.isApproved) {
    throw new AppError("Forbidden: account is pending vendor approval", 403);
  }

  next();
};
