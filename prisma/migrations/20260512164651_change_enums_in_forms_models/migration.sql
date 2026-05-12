/*
  Warnings:

  - The `status` column on the `form_submissions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `type` column on the `forms` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `forms` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "form_submissions" DROP COLUMN "status",
ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "forms" DROP COLUMN "type",
ADD COLUMN     "type" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT;
