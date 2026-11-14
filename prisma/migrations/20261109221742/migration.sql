-- CreateTable
CREATE TABLE "commercial_quote_runs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "model" TEXT NOT NULL,
    "answer" JSONB,
    "intent" JSONB,
    "sources" JSONB,
    "error_message" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_quote_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commercial_quote_runs_request_id_key" ON "commercial_quote_runs"("request_id");

-- CreateIndex
CREATE INDEX "commercial_quote_runs_user_id_created_at_idx" ON "commercial_quote_runs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "commercial_quote_runs_thread_id_created_at_idx" ON "commercial_quote_runs"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "commercial_quote_runs_status_idx" ON "commercial_quote_runs"("status");
