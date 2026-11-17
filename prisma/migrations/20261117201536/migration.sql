/*
  Warnings:

  - You are about to drop the column `cells` on the `commercial_rate_rows` table. All the data in the column will be lost.
  - You are about to drop the column `row_index` on the `commercial_rate_rows` table. All the data in the column will be lost.
  - You are about to drop the column `table_id` on the `commercial_rate_rows` table. All the data in the column will be lost.
  - You are about to drop the column `checked_at` on the `commercial_rate_tables` table. All the data in the column will be lost.
  - You are about to drop the column `headers` on the `commercial_rate_tables` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `commercial_rate_tables` table. All the data in the column will be lost.
  - You are about to drop the `commercial_operators` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `childAge` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destination` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `doubleAdult` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `doubleChild` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotel` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mealPlan` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `multipleAdult` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `multipleChild` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rowIndex` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `singleRate` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tableId` to the `commercial_rate_rows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `commercial_rate_tables` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `commercial_rate_tables` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "commercial_rate_rows" DROP CONSTRAINT "commercial_rate_rows_table_id_fkey";

-- DropIndex
DROP INDEX "commercial_rate_rows_table_id_row_index_idx";

-- AlterTable
ALTER TABLE "commercial_rate_rows" DROP COLUMN "cells",
DROP COLUMN "row_index",
DROP COLUMN "table_id",
ADD COLUMN     "childAge" TEXT NOT NULL,
ADD COLUMN     "date" TEXT NOT NULL,
ADD COLUMN     "destination" TEXT NOT NULL,
ADD COLUMN     "doubleAdult" TEXT NOT NULL,
ADD COLUMN     "doubleChild" TEXT NOT NULL,
ADD COLUMN     "hotel" TEXT NOT NULL,
ADD COLUMN     "mealPlan" TEXT NOT NULL,
ADD COLUMN     "multipleAdult" TEXT NOT NULL,
ADD COLUMN     "multipleChild" TEXT NOT NULL,
ADD COLUMN     "rowIndex" INTEGER NOT NULL,
ADD COLUMN     "singleRate" TEXT NOT NULL,
ADD COLUMN     "tableId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "commercial_rate_tables" DROP COLUMN "checked_at",
DROP COLUMN "headers",
DROP COLUMN "notes",
ADD COLUMN     "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "year" INTEGER NOT NULL;

-- DropTable
DROP TABLE "commercial_operators";

-- CreateIndex
CREATE INDEX "commercial_rate_rows_tableId_rowIndex_idx" ON "commercial_rate_rows"("tableId", "rowIndex");

-- AddForeignKey
ALTER TABLE "commercial_rate_rows" ADD CONSTRAINT "commercial_rate_rows_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "commercial_rate_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
