import { prisma } from "../../../../lib/prisma.ts";
import { AppError } from "../../../../common/errors/AppError.ts";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../validators/category.validators.ts";

export const listCategories = async () => {
  return prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      image: true,
      isActive: true,
      parentId: true,
    },
  });
};

export const createCategory = async (input: CreateCategoryInput) => {
  const existing = await prisma.category.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError("Category slug already exists", 409);

  return prisma.category.create({
    data: {
      name: input.name,
      slug: input.slug,
      isActive: input.isActive,
      description: input.description ?? null,
      image: input.image ?? null,
      ...(input.parentId !== undefined && { parentId: input.parentId }),
    },
  });
};

export const updateCategory = async (id: string, input: UpdateCategoryInput) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found", 404);

  if (input.slug && input.slug !== existing.slug) {
    const slugTaken = await prisma.category.findUnique({ where: { slug: input.slug } });
    if (slugTaken) throw new AppError("Category slug already exists", 409);
  }

  return prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.image !== undefined && { image: input.image }),
      ...(input.parentId !== undefined && { parentId: input.parentId }),
    },
  });
};

export const deleteCategory = async (id: string) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found", 404);

  return prisma.category.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
