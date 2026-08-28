import type { Request, Response } from "express";
import { asyncHandler } from "../../../../common/utils/asyncHandler.ts";
import { successResponse } from "../../../../common/utils/response.ts";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validators/category.validators.ts";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../services/category.service.ts";

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
