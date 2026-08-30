import type { Request, Response } from "express";
import { asyncHandler } from "../../../common/utils/asyncHandler.ts";
import { requireParam } from "../../../common/utils/requireParam.ts";
import { successResponse } from "../../../common/utils/response.ts";
import { AppError } from "../../../common/errors/AppError.ts";
import { getOrCreateCustomerProfile } from "../../../common/utils/customerProfile.ts";
import {
  initiatePaymentSchema,
  refundSchema,
  sslcommerzFailCancelSchema,
  sslcommerzIpnSchema,
  sslcommerzSuccessSchema,
} from "../validators/payment.validators.ts";
import {
  collectCodPayment,
  createRefund,
  initiatePayment,
} from "../services/payment.service.ts";
import {
  handleSslcommerzCancel,
  handleSslcommerzFail,
  handleSslcommerzIpn,
  handleSslcommerzSuccess,
} from "../services/sslcommerz.service.ts";

export const initiatePaymentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    const input = initiatePaymentSchema.parse(req.body);
    const customerProfile = await getOrCreateCustomerProfile(req.auth.user.id);

    successResponse(
      res,
      await initiatePayment(
        customerProfile.id,
        requireParam(req.params.orderId, "orderId"),
        input.method
      ),
      "Payment initiated",
      201
    );
  }
);

export const collectCodPaymentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    successResponse(
      res,
      await collectCodPayment(
        requireParam(req.params.paymentId, "paymentId"),
        req.auth.user.id
      ),
      "Payment collected"
    );
  }
);

export const refundPaymentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    const input = refundSchema.parse(req.body);

    successResponse(
      res,
      await createRefund(
        requireParam(req.params.paymentId, "paymentId"),
        input,
        req.auth.user.id
      ),
      "Refund created",
      201
    );
  }
);

export const sslcommerzSuccessHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = sslcommerzSuccessSchema.parse(req.body);

    successResponse(
      res,
      await handleSslcommerzSuccess(input),
      "Payment verified"
    );
  }
);

export const sslcommerzFailHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = sslcommerzFailCancelSchema.parse(req.body);

    successResponse(res, await handleSslcommerzFail(input), "Payment failed");
  }
);

export const sslcommerzCancelHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = sslcommerzFailCancelSchema.parse(req.body);

    successResponse(res, await handleSslcommerzCancel(input), "Payment cancelled");
  }
);

export const sslcommerzIpnHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = sslcommerzIpnSchema.parse(req.body);

    successResponse(res, await handleSslcommerzIpn(input), "IPN processed");
  }
);
