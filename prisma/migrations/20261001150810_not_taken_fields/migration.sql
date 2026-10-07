-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_REQUEST_UPDATED';

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "not_taken_at" TIMESTAMP(3),
ADD COLUMN     "not_taken_by_id" TEXT,
ADD COLUMN     "not_taken_reason" TEXT;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_not_taken_by_id_fkey" FOREIGN KEY ("not_taken_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
