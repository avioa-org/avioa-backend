-- CreateTable
CREATE TABLE "hotel_immediate_payment" (
    "thread_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replied_at" TIMESTAMP(3),
    "last_notification" TIMESTAMP(3),
    "notification_level" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_immediate_payment_pkey" PRIMARY KEY ("thread_id")
);
