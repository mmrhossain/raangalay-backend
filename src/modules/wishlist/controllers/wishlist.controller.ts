import type { Request, Response } from "express";
import { asyncHandler } from "../../../common/utils/asyncHandler.ts";
import { requireParam } from "../../../common/utils/requireParam.ts";
import { successResponse } from "../../../common/utils/response.ts";
import { AppError } from "../../../common/errors/AppError.ts";
import { getOrCreateCustomerProfile } from "../../../common/utils/customerProfile.ts";
import {
  addWishlistItemSchema,
  listWishlistQuerySchema,
} from "../validators/wishlist.validator.ts";
import {
  getWishlist,
  listWishlistItems,
  addWishlistItem,
  removeWishlistItem,
  clearWishlist,
  isInWishlist,
} from "../services/wishlist.service.ts";

export const getWishlistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    const customerProfile = await getOrCreateCustomerProfile(req.auth.user.id);

    successResponse(res, await getWishlist(customerProfile.id), "Wishlist fetched");
  }
);

export const listWishlistItemsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    const query = listWishlistQuerySchema.parse(req.query);
    const customerProfile = await getOrCreateCustomerProfile(req.auth.user.id);

    successResponse(
      res,
      await listWishlistItems(customerProfile.id, query),
      "Wishlist items fetched"
    );
  }
);

export const addWishlistItemHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    const input = addWishlistItemSchema.parse(req.body);
    const customerProfile = await getOrCreateCustomerProfile(req.auth.user.id);

    successResponse(
      res,
      await addWishlistItem(customerProfile.id, input.variantId),
      "Item added to wishlist",
      201
    );
  }
);

export const removeWishlistItemHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    const customerProfile = await getOrCreateCustomerProfile(req.auth.user.id);

    successResponse(
      res,
      await removeWishlistItem(
        customerProfile.id,
        requireParam(req.params.variantId, "variantId")
      ),
      "Item removed from wishlist"
    );
  }
);

export const clearWishlistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    const customerProfile = await getOrCreateCustomerProfile(req.auth.user.id);

    successResponse(res, await clearWishlist(customerProfile.id), "Wishlist cleared");
  }
);

export const isInWishlistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    const customerProfile = await getOrCreateCustomerProfile(req.auth.user.id);

    successResponse(
      res,
      await isInWishlist(
        customerProfile.id,
        requireParam(req.params.variantId, "variantId")
      ),
      "Wishlist status fetched"
    );
  }
);
