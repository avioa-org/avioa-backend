-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "maintenance_request_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "locationLocationId" TEXT,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("maintenance_request_id")
);

-- CreateIndex
CREATE INDEX "maintenance_requests_user_id_idx" ON "maintenance_requests"("user_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_equipment_id_idx" ON "maintenance_requests"("equipment_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_status_idx" ON "maintenance_requests"("status");

-- CreateIndex
CREATE INDEX "maintenance_requests_assigned_to_id_idx" ON "maintenance_requests"("assigned_to_id");

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("equipment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_locationLocationId_fkey" FOREIGN KEY ("locationLocationId") REFERENCES "locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;
