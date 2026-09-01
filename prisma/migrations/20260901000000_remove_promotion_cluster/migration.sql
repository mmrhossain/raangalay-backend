-- DropForeignKey
ALTER TABLE "Coupon" DROP CONSTRAINT "Coupon_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "Promotion" DROP CONSTRAINT "Promotion_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "PromotionCategory" DROP CONSTRAINT "PromotionCategory_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "PromotionCategory" DROP CONSTRAINT "PromotionCategory_promotionId_fkey";

-- DropForeignKey
ALTER TABLE "PromotionProduct" DROP CONSTRAINT "PromotionProduct_productId_fkey";

-- DropForeignKey
ALTER TABLE "PromotionProduct" DROP CONSTRAINT "PromotionProduct_promotionId_fkey";

-- AlterTable
ALTER TABLE "Coupon" DROP COLUMN "campaignId";

-- DropTable
DROP TABLE "Campaign";

-- DropTable
DROP TABLE "Promotion";

-- DropTable
DROP TABLE "PromotionCategory";

-- DropTable
DROP TABLE "PromotionProduct";

-- DropEnum
DROP TYPE "PromotionType";
