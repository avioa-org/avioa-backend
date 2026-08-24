/*
  Warnings:

  - You are about to drop the column `department_id` on the `password_permission` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "password_permission_department_id_idx";

-- AlterTable
ALTER TABLE "password_permission" DROP COLUMN "department_id",
ADD COLUMN     "department" TEXT;

-- CreateIndex
CREATE INDEX "password_permission_department_idx" ON "password_permission"("department");
