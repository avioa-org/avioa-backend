-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('AUTOMATIC', 'MANUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'POINT_APPROVAL';
ALTER TYPE "NotificationType" ADD VALUE 'POINT_REJECTION';
ALTER TYPE "NotificationType" ADD VALUE 'REWARD_REDEMPTION';
ALTER TYPE "NotificationType" ADD VALUE 'REWARD_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'REWARD_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'REWARD_COMPLETED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RedemptionStatus" ADD VALUE 'IN_PROCESS';
ALTER TYPE "RedemptionStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "RedemptionStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "reward_redemptions" ADD COLUMN     "delivery_date" TIMESTAMP(3),
ADD COLUMN     "processed_at" TIMESTAMP(3),
ADD COLUMN     "processed_by" TEXT,
ADD COLUMN     "rejection_reason" TEXT;

-- AlterTable
ALTER TABLE "rewards" ADD COLUMN     "delivery_content" JSONB,
ADD COLUMN     "delivery_method" TEXT,
ADD COLUMN     "type" "RewardType" NOT NULL DEFAULT 'MANUAL';
