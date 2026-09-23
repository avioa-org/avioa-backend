-- AlterEnum
ALTER TYPE "LeaveStatus" ADD VALUE 'PENDING_HR_VALIDATION';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMPENSATED_LEAVE_PENDING_HR';

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "external_approval_ref" TEXT,
ADD COLUMN     "external_approved_at" TIMESTAMP(3),
ADD COLUMN     "hr_comment" TEXT,
ADD COLUMN     "hr_validated_at" TIMESTAMP(3),
ADD COLUMN     "hr_validated_by_id" TEXT,
ADD COLUMN     "notified_accounting_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "leave_requests_status_es_compensada_idx" ON "leave_requests"("status", "es_compensada");

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_hr_validated_by_id_fkey" FOREIGN KEY ("hr_validated_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
