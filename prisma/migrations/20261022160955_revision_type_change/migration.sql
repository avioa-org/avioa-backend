/*
  Warnings:

  - Changed the type of `revision` on the `auxiliary_records` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "auxiliary_records" DROP COLUMN "revision",
ADD COLUMN     "revision" INTEGER NOT NULL;
