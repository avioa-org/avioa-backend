-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'EQUIPMENT_LOAN_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'EQUIPMENT_LOAN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'EQUIPMENT_LOAN_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'EQUIPMENT_LOAN_RETURNED';
