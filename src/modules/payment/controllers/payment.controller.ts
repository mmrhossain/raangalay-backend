import type { Request, Response } from "express";
import { asyncHandler } from "../../../common/utils/asyncHandler.ts";
import { requireParam } from "../../../common/utils/requireParam.ts";
import { successResponse } from "../../../common/utils/response.ts";
import { AppError } from "../../../common/errors/AppError.ts";
import { getOrCreateCustomerProfile } from "../../../common/utils/customerProfile.ts";
import { initiatePaymentSchema } from "../validators/payment.validators.ts";
import {
  initiatePayment,
  collectCodPayment,
} from "../services/payment.service.ts";

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
