/*
  Warnings:

  - A unique constraint covering the columns `[sheet_row]` on the table `operaciones` will be added. If there are existing duplicate values, this will fail.
  - Made the column `cantidad_alertas` on table `operaciones` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "operaciones" ADD COLUMN     "cliente" TEXT,
ADD COLUMN     "sheet_row" INTEGER,
ALTER COLUMN "es_avianca" SET DEFAULT false,
ALTER COLUMN "cantidad_alertas" SET NOT NULL,
ALTER COLUMN "cantidad_alertas" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "operaciones_sheet_row_key" ON "operaciones"("sheet_row");
