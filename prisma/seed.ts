import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.ts";

const ROLES = ["CUSTOMER", "ADMIN", "VENDOR"] as const;

async function main() {
  const roleRecords: Record<string, { id: string }> = {};

  for (const roleName of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `${roleName} role`,
      },
    });

    roleRecords[roleName] = role;
  }

  const permissions = [
    "catalog:read",
    "catalog:write",
    "inventory:manage",
    "order:read",
    "order:write",
    "payment:manage",
    "coupon:manage",
    "review:moderate",
    "user:manage",
  ];

  for (const permName of permissions) {
    const permission = await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: {
        name: permName,
        description: `Permission: ${permName}`,
      },
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: roleRecords["ADMIN"]!.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: roleRecords["ADMIN"]!.id,
        permissionId: permission.id,
      },
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@raangalay.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@123";

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existing) {
    const hashed = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        name: "Admin",
        firstName: "Admin",
        email: adminEmail,
        password: hashed,
        emailVerified: true,
        isApproved: true,
        role: "ADMIN",
        roleId: roleRecords["ADMIN"]!.id,
      },
    });

    console.log(`[seed] admin user created: ${adminEmail}`);
  } else {
    console.log(`[seed] admin user already exists: ${adminEmail}`);
  }

  console.log("[seed] roles, permissions and admin user ready");
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
