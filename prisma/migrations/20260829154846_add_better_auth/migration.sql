/*
  Warnings:

  - You are about to drop the column `browser` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `deviceName` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `lastActivityAt` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `operatingSystem` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `session` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `isPhoneVerified` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `roleId` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RolePermission` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `name` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "user" DROP CONSTRAINT "user_roleId_fkey";

-- DropIndex
DROP INDEX "session_expiresAt_idx";

-- DropIndex
DROP INDEX "session_status_idx";

-- DropIndex
DROP INDEX "user_email_idx";

-- DropIndex
DROP INDEX "user_phone_idx";

-- DropIndex
DROP INDEX "user_phone_key";

-- DropIndex
DROP INDEX "user_roleId_idx";

-- DropIndex
DROP INDEX "user_status_idx";

-- AlterTable
ALTER TABLE "session" DROP COLUMN "browser",
DROP COLUMN "deletedAt",
DROP COLUMN "deviceName",
DROP COLUMN "lastActivityAt",
DROP COLUMN "operatingSystem",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "deletedAt",
DROP COLUMN "firstName",
DROP COLUMN "isPhoneVerified",
DROP COLUMN "lastName",
DROP COLUMN "password",
DROP COLUMN "phone",
DROP COLUMN "roleId",
DROP COLUMN "status",
ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "isApproved" DROP NOT NULL;

-- DropTable
DROP TABLE "Permission";

-- DropTable
DROP TABLE "RefreshToken";

-- DropTable
DROP TABLE "Role";

-- DropTable
DROP TABLE "RolePermission";
