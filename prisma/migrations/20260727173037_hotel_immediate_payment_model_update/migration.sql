/*
  Warnings:

  - The primary key for the `hotel_immediate_payment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `last_notification` on the `hotel_immediate_payment` table. All the data in the column will be lost.
  - You are about to drop the column `message_id` on the `hotel_immediate_payment` table. All the data in the column will be lost.
  - You are about to drop the column `replied_at` on the `hotel_immediate_payment` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `hotel_immediate_payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[thread_id]` on the table `hotel_immediate_payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email_received_at` to the `hotel_immediate_payment` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `hotel_immediate_payment` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "hotel_immediate_payment" DROP CONSTRAINT "hotel_immediate_payment_pkey",
DROP COLUMN "last_notification",
DROP COLUMN "message_id",
DROP COLUMN "replied_at",
DROP COLUMN "status",
ADD COLUMN     "answered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email_received_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "last_notified_at" TIMESTAMP(3),
ALTER COLUMN "subject" DROP NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "hotel_immediate_payment_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_immediate_payment_thread_id_key" ON "hotel_immediate_payment"("thread_id");

-- CreateIndex
CREATE INDEX "hotel_immediate_payment_answered_notification_level_idx" ON "hotel_immediate_payment"("answered", "notification_level");
