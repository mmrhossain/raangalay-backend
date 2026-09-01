import { z } from "zod";
import { registry } from "../../lib/openapi/registry.ts";
import { bearerAuth } from "../../lib/openapi/security.ts";
import {
  errorResponses,
  jsonBody,
  successResponse,
} from "../../lib/openapi/common-schemas.ts";
import {
  initiatePaymentSchema,
  refundSchema,
  sslcommerzFailCancelSchema,
  sslcommerzIpnSchema,
  sslcommerzSuccessSchema,
} from "./validators/payment.validators.ts";

const TAG = "Payments";

registry.registerPath({
  method: "post",
  path: "/api/v1/payments/{orderId}/initiate",
  tags: [TAG],
  summary: "Initiate payment for an order",
  security: bearerAuth,
  request: {
    params: z.object({ orderId: z.string().min(1) }),
    body: jsonBody(initiatePaymentSchema),
  },
  responses: {
    201: successResponse("Payment initiated"),
    ...errorResponses(400, 401, 404, 429),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/payments/sslcommerz/success",
  tags: [TAG],
  summary: "SSLCommerz success callback (signature-based, no bearer auth)",
  security: [],
  request: { body: jsonBody(sslcommerzSuccessSchema) },
  responses: {
    200: successResponse("Payment verified"),
    ...errorResponses(400),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/payments/sslcommerz/fail",
  tags: [TAG],
  summary: "SSLCommerz fail callback (signature-based, no bearer auth)",
  security: [],
  request: { body: jsonBody(sslcommerzFailCancelSchema) },
  responses: {
    200: successResponse("Payment failed"),
    ...errorResponses(400),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/payments/sslcommerz/cancel",
  tags: [TAG],
  summary: "SSLCommerz cancel callback (signature-based, no bearer auth)",
  security: [],
  request: { body: jsonBody(sslcommerzFailCancelSchema) },
  responses: {
    200: successResponse("Payment cancelled"),
    ...errorResponses(400),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/payments/sslcommerz/ipn",
  tags: [TAG],
  summary: "SSLCommerz IPN webhook (signature-based, no bearer auth)",
  security: [],
  request: { body: jsonBody(sslcommerzIpnSchema) },
  responses: {
    200: successResponse("IPN processed"),
    ...errorResponses(400),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/admin/payments/cod/{paymentId}/collect",
  tags: [TAG],
  summary: "Collect COD payment (admin)",
  security: bearerAuth,
  request: { params: z.object({ paymentId: z.string().min(1) }) },
  responses: {
    200: successResponse("Payment collected"),
    ...errorResponses(401, 403, 404),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/admin/payments/{paymentId}/refund",
  tags: [TAG],
  summary: "Refund a payment (admin)",
  security: bearerAuth,
  request: {
    params: z.object({ paymentId: z.string().min(1) }),
    body: jsonBody(refundSchema),
  },
  responses: {
    201: successResponse("Refund created"),
    ...errorResponses(400, 401, 403, 404),
  },
});
