import { prisma } from "../../lib/prisma.ts";

export const getOrCreateCustomerProfile = async (userId: string) => {
  const existing = await prisma.customerProfile.findUnique({ where: { userId } });

  if (existing) return existing;

  const count = await prisma.customerProfile.count();
  const customerCode = `CUST-${String(count + 1).padStart(6, "0")}`;

  return prisma.customerProfile.create({
    data: {
      userId,
      customerCode,
    },
  });
};
