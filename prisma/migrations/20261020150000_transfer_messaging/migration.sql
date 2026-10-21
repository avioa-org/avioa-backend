CREATE TABLE "transfer_gmail_connections" (
  "user_id" TEXT NOT NULL, "email" TEXT NOT NULL, "encrypted_refresh_token" TEXT NOT NULL,
  "refresh_token_iv" TEXT NOT NULL, "refresh_token_tag" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'CONNECTED',
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transfer_gmail_connections_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "transfer_gmail_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "transfer_gmail_oauth_states" (
  "state_hash" TEXT NOT NULL, "user_id" TEXT NOT NULL, "verifier" TEXT NOT NULL, "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transfer_gmail_oauth_states_pkey" PRIMARY KEY ("state_hash"),
  CONSTRAINT "transfer_gmail_oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "transfer_gmail_oauth_states_expires_at_idx" ON "transfer_gmail_oauth_states"("expires_at");
CREATE TABLE "transfer_email_deliveries" (
  "delivery_id" TEXT NOT NULL, "transfer_request_id" TEXT NOT NULL, "version" INTEGER NOT NULL, "preview_hash" TEXT NOT NULL,
  "sender" TEXT NOT NULL, "recipients" TEXT NOT NULL, "status" TEXT NOT NULL, "provider_message_id" TEXT, "error" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transfer_email_deliveries_pkey" PRIMARY KEY ("delivery_id"),
  CONSTRAINT "transfer_email_deliveries_request_fkey" FOREIGN KEY ("transfer_request_id") REFERENCES "transfer_requests"("transfer_request_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "transfer_email_deliveries_transfer_request_id_version_key" ON "transfer_email_deliveries"("transfer_request_id","version");
CREATE INDEX "transfer_email_deliveries_transfer_request_id_created_at_idx" ON "transfer_email_deliveries"("transfer_request_id","created_at");
CREATE TABLE "transfer_whatsapp_deliveries" (
  "delivery_id" TEXT NOT NULL, "transfer_request_id" TEXT NOT NULL, "version" INTEGER NOT NULL, "preview_hash" TEXT NOT NULL,
  "instance" TEXT NOT NULL, "number" TEXT NOT NULL, "status" TEXT NOT NULL, "provider_message_id" TEXT, "error" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transfer_whatsapp_deliveries_pkey" PRIMARY KEY ("delivery_id"),
  CONSTRAINT "transfer_whatsapp_deliveries_request_fkey" FOREIGN KEY ("transfer_request_id") REFERENCES "transfer_requests"("transfer_request_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "transfer_whatsapp_deliveries_transfer_request_id_version_key" ON "transfer_whatsapp_deliveries"("transfer_request_id","version");
CREATE INDEX "transfer_whatsapp_deliveries_transfer_request_id_created_at_idx" ON "transfer_whatsapp_deliveries"("transfer_request_id","created_at");