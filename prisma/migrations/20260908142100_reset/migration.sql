/*
  Warnings:

  - The primary key for the `equipment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `equipment` table. All the data in the column will be lost.
  - The primary key for the `equipment_loans` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `equipment_loans` table. All the data in the column will be lost.
  - The primary key for the `locations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `locations` table. All the data in the column will be lost.
  - The required column `equipment_id` was added to the `equipment` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `equipment_loan_id` was added to the `equipment_loans` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `location_id` was added to the `locations` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "equipment" DROP CONSTRAINT "equipment_location_id_fkey";

-- DropForeignKey
ALTER TABLE "equipment_loans" DROP CONSTRAINT "equipment_loans_equipment_id_fkey";

-- AlterTable
ALTER TABLE "equipment" DROP CONSTRAINT "equipment_pkey",
DROP COLUMN "id",
ADD COLUMN     "equipment_id" TEXT NOT NULL,
ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("equipment_id");

-- AlterTable
ALTER TABLE "equipment_loans" DROP CONSTRAINT "equipment_loans_pkey",
DROP COLUMN "id",
ADD COLUMN     "equipment_loan_id" TEXT NOT NULL,
ADD CONSTRAINT "equipment_loans_pkey" PRIMARY KEY ("equipment_loan_id");

-- AlterTable
ALTER TABLE "locations" DROP CONSTRAINT "locations_pkey",
DROP COLUMN "id",
ADD COLUMN     "location_id" TEXT NOT NULL,
ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("location_id");

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_loans" ADD CONSTRAINT "equipment_loans_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("equipment_id") ON DELETE RESTRICT ON UPDATE CASCADE;
