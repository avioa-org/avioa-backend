/*
  Warnings:

  - You are about to drop the column `created_by` on the `knowledge_file` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "knowledge_file" DROP COLUMN "created_by";

-- AddForeignKey
ALTER TABLE "knowledge_file" ADD CONSTRAINT "knowledge_file_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
