import type { Request, Response } from "express";
import { asyncHandler } from "../../../../common/utils/asyncHandler.ts";
import { successResponse } from "../../../../common/utils/response.ts";
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  listProductsQuerySchema,
} from "../validators/product.validators.ts";
import {
  listProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  createVariant,
  updateVariant,
  deleteVariant,
} from "../services/product.service.ts";

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = listProductsQuerySchema.parse(req.query);
  successResponse(res, await listProducts(query), "Products fetched");
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await getProductBySlug(req.params.slug, false),
    "Product fetched"
  );
});

export const createProductHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = createProductSchema.parse(req.body);
    successResponse(res, await createProduct(input), "Product created", 201);
  }
);

export const updateProductHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = updateProductSchema.parse(req.body);
    successResponse(
      res,
      await updateProduct(req.params.id, input),
      "Product updated"
    );
  }
);

export const deleteProductHandler = asyncHandler(
  async (req: Request, res: Response) => {
    successResponse(res, await deleteProduct(req.params.id), "Product deleted");
  }
);

export const createVariantHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = createVariantSchema.parse(req.body);
    successResponse(
      res,
      await createVariant(req.params.productId, input),
      "Variant created",
      201
    );
  }
);

export const updateVariantHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = updateVariantSchema.parse(req.body);
    successResponse(
      res,
      await updateVariant(req.params.id, input),
      "Variant updated"
    );
  }
);

export const deleteVariantHandler = asyncHandler(
  async (req: Request, res: Response) => {
    successResponse(res, await deleteVariant(req.params.id), "Variant deleted");
  }
);
