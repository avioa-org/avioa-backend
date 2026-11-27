CREATE TABLE "offers_hunter_captures" (
 "capture_date" TEXT PRIMARY KEY, "payload" TEXT NOT NULL, "rates" INTEGER NOT NULL,
 "source_count" INTEGER NOT NULL DEFAULT 0, "snapshot_until_id" INTEGER NOT NULL DEFAULT 0,
 "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "offers_hunter_sync_state" (
 "id" INTEGER PRIMARY KEY, "last_success_at" TIMESTAMPTZ(3), "last_full_at" TIMESTAMPTZ(3),
 "last_error" TEXT, "last_watermark" INTEGER NOT NULL DEFAULT 0, "total_rates" INTEGER NOT NULL DEFAULT 0
);
