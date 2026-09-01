import { z } from "zod";
import { registry } from "../../lib/openapi/registry.ts";
import { bearerAuth } from "../../lib/openapi/security.ts";
import {
  errorResponses,
  jsonBody,
  successResponse,
} from "../../lib/openapi/common-schemas.ts";
import {
  adminListUsersQuerySchema,
  approveUserSchema,
  vendorApplySchema,
} from "./auth.validator.ts";

const TAG = "Auth";

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/vendor/apply",
  tags: [TAG],
  summary: "Apply to become a vendor",
  security: bearerAuth,
  request: { body: jsonBody(vendorApplySchema) },
  responses: {
    201: successResponse("Vendor application submitted"),
    ...errorResponses(400, 401, 409),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/auth/admin/users",
  tags: [TAG],
  summary: "List users (admin)",
  security: bearerAuth,
  request: { query: adminListUsersQuerySchema },
  responses: {
    200: successResponse("Users fetched"),
    ...errorResponses(400, 401, 403),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/admin/users/{id}/approve",
  tags: [TAG],
  summary: "Approve or reject a user (admin)",
  security: bearerAuth,
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: jsonBody(approveUserSchema),
  },
  responses: {
    200: successResponse("User approval status updated"),
    ...errorResponses(400, 401, 403, 404),
  },
});
