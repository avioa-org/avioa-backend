-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'OVERTIME_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'OVERTIME_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'OVERTIME_REJECTED';

-- CreateTable
CREATE TABLE "overtime_requests" (
    "overtime_request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "leader_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "total_hours" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("overtime_request_id")
);

-- CreateIndex
CREATE INDEX "overtime_requests_user_id_idx" ON "overtime_requests"("user_id");

-- CreateIndex
CREATE INDEX "overtime_requests_leader_id_idx" ON "overtime_requests"("leader_id");

-- CreateIndex
CREATE INDEX "overtime_requests_status_idx" ON "overtime_requests"("status");

-- CreateIndex
CREATE INDEX "overtime_requests_date_idx" ON "overtime_requests"("date");

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
