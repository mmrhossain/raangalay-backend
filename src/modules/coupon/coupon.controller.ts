import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.ts";
import { requireParam } from "../../common/utils/requireParam.ts";
import { successResponse } from "../../common/utils/response.ts";
import { AppError } from "../../common/errors/AppError.ts";
import {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
  listCouponsQuerySchema,
} from "./coupon.validator.ts";
import {
  validateCouponCode,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "./coupon.service.ts";
import { getOrCreateCustomerProfile } from "../../common/utils/customerProfile.ts";

export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError("Unauthorized", 401);

  const input = validateCouponSchema.parse({ code: req.query.code ?? req.body.code });

  const customerProfile = await getOrCreateCustomerProfile(req.auth.user.id);

  const result = await validateCouponCode(input.code, customerProfile.id, {
    subtotal: Number(req.query.subtotal ?? 0),
    productIds: [],
    productCategoryIds: [],
  });

  successResponse(
    res,
    { code: result.coupon.code, discountAmount: result.discountAmount },
    "Coupon is valid"
  );
});

export const adminListCoupons = asyncHandler(
  async (req: Request, res: Response) => {
    const query = listCouponsQuerySchema.parse(req.query);
    successResponse(res, await listCoupons(query.page, query.limit), "Coupons fetched");
  }
);

export const adminCreateCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const input = createCouponSchema.parse(req.body);
    successResponse(res, await createCoupon(input), "Coupon created", 201);
  }
);

export const adminUpdateCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const input = updateCouponSchema.parse(req.body);
    successResponse(
      res,
      await updateCoupon(requireParam(req.params.id, "id"), input),
      "Coupon updated"
    );
  }
);

export const adminDeleteCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    successResponse(
      res,
      await deleteCoupon(requireParam(req.params.id, "id")),
      "Coupon deleted"
    );
  }
);
