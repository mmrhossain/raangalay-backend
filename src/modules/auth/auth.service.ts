import { prisma } from "../../lib/prisma.ts";
import { AppError } from "../../common/errors/AppError.ts";
import type {
  AdminListUsersQuery,
  VendorApplyInput,
} from "./auth.validator.ts";

export const applyAsVendor = async (userId: string, input: VendorApplyInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const existingSlug = await prisma.vendorProfile.findUnique({
    where: { shopSlug: input.shopSlug },
  });

  if (existingSlug) {
    throw new AppError("Shop slug already exists", 409);
  }

  const vendorProfile = await prisma.vendorProfile.create({
    data: {
      shopName: input.shopName,
      shopSlug: input.shopSlug,
      description: input.description ?? null,
      logo: input.logo ?? null,
      userId,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { role: "VENDOR" },
  });

  return vendorProfile;
};

export const listUsers = async (query: AdminListUsersQuery) => {
  const where = {
    ...(query.role && { role: query.role }),
    ...(query.status && { status: query.status }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isApproved: true,
        status: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: users,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const approveUser = async (userId: string, isApproved: boolean) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vendorProfile: true },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const [updatedUser] = await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { isApproved },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        status: true,
      },
    }),
    user.vendorProfile
      ? prisma.vendorProfile.update({
          where: { userId },
          data: { isApproved },
        })
      : Promise.resolve(null),
  ]);

  return updatedUser;
};
