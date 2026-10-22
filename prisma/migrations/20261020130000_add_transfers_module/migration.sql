CREATE TYPE "TransferRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "TransferDestination" AS ENUM ('CARTAGENA', 'SANTA_MARTA', 'SAN_ANDRES', 'PALOMINO', 'BARU');
CREATE TYPE "TransferProviderChannel" AS ENUM ('EMAIL', 'WHATSAPP');

CREATE TABLE "transfer_providers" (
  "provider_id" TEXT NOT NULL,
  "destination" "TransferDestination" NOT NULL,
  "name" TEXT NOT NULL,
  "channel" "TransferProviderChannel" NOT NULL,
  "contact" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transfer_providers_pkey" PRIMARY KEY ("provider_id")
);

CREATE TABLE "transfer_requests" (
  "transfer_request_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "TransferRequestStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transfer_requests_pkey" PRIMARY KEY ("transfer_request_id")
);

CREATE INDEX "transfer_providers_destination_is_active_idx" ON "transfer_providers"("destination", "is_active");
CREATE INDEX "transfer_requests_user_id_created_at_idx" ON "transfer_requests"("user_id", "created_at");

ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
