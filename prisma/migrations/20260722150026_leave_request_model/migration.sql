-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('VACACIONES', 'INCAPACIDAD_EPS', 'INCAPACIDAD_ARL', 'LICENCIA_MATERNIDAD', 'LICENCIA_PATERNIDAD', 'LICENCIA_LUTO', 'LICENCIA_MATRIMONIO', 'PERMISO_REMUNERADO', 'PERMISO_NO_REMUNERADO', 'CALAMIDAD_DOMESTICA', 'OTRO');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "leave_requests" (
    "leave_request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "leader_id" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "business_days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "attachment_url" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("leave_request_id")
);

-- CreateIndex
CREATE INDEX "leave_requests_user_id_idx" ON "leave_requests"("user_id");

-- CreateIndex
CREATE INDEX "leave_requests_leader_id_idx" ON "leave_requests"("leader_id");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_requests_type_idx" ON "leave_requests"("type");

-- CreateIndex
CREATE INDEX "leave_requests_start_date_idx" ON "leave_requests"("start_date");

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
