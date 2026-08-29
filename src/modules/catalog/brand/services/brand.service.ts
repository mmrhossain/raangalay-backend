import { prisma } from "../../../../lib/prisma.ts";
import { AppError } from "../../../../common/errors/AppError.ts";
import type {
  CreateBrandInput,
  UpdateBrandInput,
} from "../validators/brand.validators.ts";

export const listBrands = async () => {
  return prisma.brand.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      description: true,
      isActive: true,
    },
  });
};

export const createBrand = async (input: CreateBrandInput) => {
  const existing = await prisma.brand.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError("Brand slug already exists", 409);

  return prisma.brand.create({
    data: {
      name: input.name,
      slug: input.slug,
      isActive: input.isActive,
      logo: input.logo ?? null,
      description: input.description ?? null,
    },
  });
};

export const updateBrand = async (id: string, input: UpdateBrandInput) => {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new AppError("Brand not found", 404);

  return prisma.brand.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.logo !== undefined && { logo: input.logo }),
      ...(input.description !== undefined && { description: input.description }),
    },
  });
};

export const deleteBrand = async (id: string) => {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new AppError("Brand not found", 404);

  return prisma.brand.update({ where: { id }, data: { deletedAt: new Date() } });
};
