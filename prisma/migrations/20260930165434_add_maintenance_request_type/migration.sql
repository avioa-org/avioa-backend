/*
  Warnings:

  - You are about to drop the column `locationLocationId` on the `maintenance_requests` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MaintenanceRequestType" AS ENUM ('EQUIPMENT', 'GENERAL');

-- DropForeignKey
ALTER TABLE "maintenance_requests" DROP CONSTRAINT "maintenance_requests_equipment_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_requests" DROP CONSTRAINT "maintenance_requests_locationLocationId_fkey";

-- DropIndex
DROP INDEX "maintenance_requests_assigned_to_id_idx";

-- AlterTable
ALTER TABLE "maintenance_requests" DROP COLUMN "locationLocationId",
ADD COLUMN     "location_id" TEXT,
ADD COLUMN     "request_type" "MaintenanceRequestType" NOT NULL DEFAULT 'EQUIPMENT',
ALTER COLUMN "equipment_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "maintenance_requests_location_id_idx" ON "maintenance_requests"("location_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_request_type_idx" ON "maintenance_requests"("request_type");

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("equipment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;
