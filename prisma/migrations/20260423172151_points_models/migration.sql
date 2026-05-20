-- CreateEnum
CREATE TYPE "PointRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PointTransactionType" AS ENUM ('EARN', 'REDEEM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('POINT_REQUEST', 'APPROVAL', 'REJECTION');

-- CreateTable
CREATE TABLE "point_requests" (
    "point_request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "leader_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" "PointRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decision" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "point_requests_pkey" PRIMARY KEY ("point_request_id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "point_transaction_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "request_id" TEXT,
    "type" "PointTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("point_transaction_id")
);

-- CreateTable
CREATE TABLE "point_wallets" (
    "point_wallet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "point_wallets_pkey" PRIMARY KEY ("point_wallet_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateIndex
CREATE INDEX "point_requests_user_id_idx" ON "point_requests"("user_id");

-- CreateIndex
CREATE INDEX "point_requests_leader_id_idx" ON "point_requests"("leader_id");

-- CreateIndex
CREATE INDEX "point_requests_status_idx" ON "point_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "point_wallets_user_id_key" ON "point_wallets"("user_id");

-- AddForeignKey
ALTER TABLE "point_requests" ADD CONSTRAINT "point_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_requests" ADD CONSTRAINT "point_requests_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "point_requests"("point_request_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_wallets" ADD CONSTRAINT "point_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
