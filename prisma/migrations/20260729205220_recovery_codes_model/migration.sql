/*
  Warnings:

  - You are about to drop the column `recovery_codes` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "recovery_codes";

-- CreateTable
CREATE TABLE "recovery_code" (
    "recovery_code_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_code_pkey" PRIMARY KEY ("recovery_code_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recovery_code_hash_key" ON "recovery_code"("hash");

-- CreateIndex
CREATE INDEX "recovery_code_user_id_hash_idx" ON "recovery_code"("user_id", "hash");

-- AddForeignKey
ALTER TABLE "recovery_code" ADD CONSTRAINT "recovery_code_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
