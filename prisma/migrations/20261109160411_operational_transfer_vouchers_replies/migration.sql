-- AlterTable
ALTER TABLE "auxop_transfer_vouchers" ADD COLUMN     "last_reply_at" TEXT,
ADD COLUMN     "reply_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "thread_id" TEXT;

-- CreateTable
CREATE TABLE "auxop_transfer_voucher_replies" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "received_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "auxop_transfer_voucher_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auxop_transfer_voucher_replies_message_id_key" ON "auxop_transfer_voucher_replies"("message_id");

-- CreateIndex
CREATE INDEX "idx_auxop_transfer_reply_thread" ON "auxop_transfer_voucher_replies"("thread_id");

-- CreateIndex
CREATE INDEX "idx_auxop_transfer_reply_voucher" ON "auxop_transfer_voucher_replies"("voucher_id");

-- AddForeignKey
ALTER TABLE "auxop_transfer_voucher_replies" ADD CONSTRAINT "auxop_transfer_voucher_replies_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "auxop_transfer_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
