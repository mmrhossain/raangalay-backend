import { env } from "../config/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import type { Prisma } from "../generated/prisma/client";

// 2. Connection string
const connectionString = env.DATABASE_URL;


// 1. Validate env (important in production)
if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}


// 3. Adapter (PostgreSQL pooling)
const adapter = new PrismaPg({
  connectionString,
});

// 4. Singleton pattern (VERY IMPORTANT for dev + hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

// Prevent multiple instances in development
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type TransactionClient = Prisma.TransactionClient;

export const transaction = <T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
): Promise<T> => {
  return prisma.$transaction(fn, options);
};