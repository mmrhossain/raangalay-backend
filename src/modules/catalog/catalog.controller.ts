import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler.ts";
import { successResponse } from "../../common/utils/response.ts";
import { AppError } from "../../common/errors/AppError.ts";
import {
  createCategorySchema,
  updateCategorySchema,
  createBrandSchema,
  updateBrandSchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  createInventoryAdjustmentSchema,
  approveInventoryAdjustmentSchema,
  createInventoryTransferSchema,
  listProductsQuerySchema,
  listInventoryQuerySchema,
} from "./catalog.validator.ts";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  listProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  createVariant,
  updateVariant,
  deleteVariant,
  listInventory,
  createInventoryAdjustment,
  approveInventoryAdjustment,
  createInventoryTransfer,
  completeInventoryTransfer,
  listInventoryAdjustments,
  listInventoryTransfers,
} from "./catalog.service.ts";

// -------------------- Categories --------------------

export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  successResponse(res, await listCategories(), "Categories fetched");
});

export const createCategoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = createCategorySchema.parse(req.body);
    successResponse(res, await createCategory(input), "Category created", 201);
  }
);

export const updateCategoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = updateCategorySchema.parse(req.body);
    successResponse(
      res,
      await updateCategory(req.params.id, input),
      "Category updated"
    );
  }
);

export const deleteCategoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    successResponse(res, await deleteCategory(req.params.id), "Category deleted");
  }
);

// -------------------- Brands --------------------

export const getBrands = asyncHandler(async (_req: Request, res: Response) => {
  successResponse(res, await listBrands(), "Brands fetched");
});

export const createBrandHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = createBrandSchema.parse(req.body);
    successResponse(res, await createBrand(input), "Brand created", 201);
  }
);

export const updateBrandHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = updateBrandSchema.parse(req.body);
    successResponse(res, await updateBrand(req.params.id, input), "Brand updated");
  }
);

export const deleteBrandHandler = asyncHandler(
  async (req: Request, res: Response) => {
    successResponse(res, await deleteBrand(req.params.id), "Brand deleted");
  }
);

// -------------------- Products --------------------

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

// -------------------- Inventory --------------------

export const getInventory = asyncHandler(async (req: Request, res: Response) => {
  const query = listInventoryQuerySchema.parse(req.query);
  successResponse(res, await listInventory(query), "Inventory fetched");
});

export const createAdjustmentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    const input = createInventoryAdjustmentSchema.parse(req.body);
    successResponse(
      res,
      await createInventoryAdjustment(input, req.auth.user.id),
      "Inventory adjustment created",
      201
    );
  }
);

export const approveAdjustmentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    const input = approveInventoryAdjustmentSchema.parse(req.body);
    successResponse(
      res,
      await approveInventoryAdjustment(req.params.id, input.approved, req.auth.user.id),
      "Inventory adjustment processed"
    );
  }
);

export const getAdjustments = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  successResponse(res, await listInventoryAdjustments(page, limit), "Adjustments fetched");
});

export const createTransferHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    const input = createInventoryTransferSchema.parse(req.body);
    successResponse(
      res,
      await createInventoryTransfer(input, req.auth.user.id),
      "Inventory transfer created",
      201
    );
  }
);

export const completeTransferHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.auth) throw new AppError("Unauthorized", 401);

    successResponse(
      res,
      await completeInventoryTransfer(req.params.id, req.auth.user.id),
      "Inventory transfer completed"
    );
  }
);

export const getTransfers = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  successResponse(res, await listInventoryTransfers(page, limit), "Transfers fetched");
});
