ALTER TABLE "transfer_requests" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "transfer_request_events" (
  "event_id" TEXT NOT NULL,
  "transfer_request_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transfer_request_events_pkey" PRIMARY KEY ("event_id")
);

CREATE INDEX "transfer_request_events_transfer_request_id_created_at_idx" ON "transfer_request_events"("transfer_request_id", "created_at");
ALTER TABLE "transfer_request_events" ADD CONSTRAINT "transfer_request_events_transfer_request_id_fkey" FOREIGN KEY ("transfer_request_id") REFERENCES "transfer_requests"("transfer_request_id") ON DELETE CASCADE ON UPDATE CASCADE;
