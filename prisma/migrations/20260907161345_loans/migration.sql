-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('LAPTOP', 'CELLPHONE', 'KEYBOARD', 'MOUSE', 'HEADPHONES', 'MONITOR', 'PRINTER', 'PROJECTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'LOANED', 'MAINTENANCE', 'DAMAGED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'LOANED', 'RETURNED', 'OVERDUE', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serial_number" TEXT,
    "category" "EquipmentCategory" NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "location_id" TEXT,
    "description" TEXT,
    "purchase_date" TIMESTAMP(3),
    "purchase_cost" DECIMAL(12,2),
    "warranty_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_loans" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "returned_by_id" TEXT,
    "loan_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_return_date" TIMESTAMP(3) NOT NULL,
    "actual_return_date" TIMESTAMP(3),
    "reason" TEXT,
    "observation" TEXT,
    "rejection_reason" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_serial_number_key" ON "equipment"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_key" ON "locations"("name");

-- CreateIndex
CREATE INDEX "equipment_loans_user_id_idx" ON "equipment_loans"("user_id");

-- CreateIndex
CREATE INDEX "equipment_loans_equipment_id_idx" ON "equipment_loans"("equipment_id");

-- CreateIndex
CREATE INDEX "equipment_loans_status_idx" ON "equipment_loans"("status");

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_loans" ADD CONSTRAINT "equipment_loans_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_loans" ADD CONSTRAINT "equipment_loans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_loans" ADD CONSTRAINT "equipment_loans_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_loans" ADD CONSTRAINT "equipment_loans_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
