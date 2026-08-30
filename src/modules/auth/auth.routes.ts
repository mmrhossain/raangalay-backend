import { Router } from "express";
import { auth } from "../../lib/auth.ts";
import {
  requireAuth,
  requireRole,
} from "../../common/middleware/auth.middleware.ts";
import { authLimiter } from "../../common/middleware/rate-limit.middleware.ts";
import {
  getMe,
  vendorApply,
  adminListUsers,
  adminApproveUser,
} from "./auth.controller.ts";

const router = Router();



router.post(
  "/auth/vendor/apply",
  authLimiter,
  requireAuth,
  vendorApply
);

router.get(
  "/auth/admin/users",
  authLimiter,
  requireAuth,
  requireRole("ADMIN"),
  adminListUsers
);

router.post(
  "/auth/admin/users/:id/approve",
  authLimiter,
  requireAuth,
  requireRole("ADMIN"),
  adminApproveUser
);

export default router;
