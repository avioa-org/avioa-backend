-- CreateTable
CREATE TABLE "auxop_audit" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "at" TEXT NOT NULL,

    CONSTRAINT "auxop_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxop_documents" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reservation_code" TEXT NOT NULL DEFAULT '',
    "encrypted_data" TEXT NOT NULL,
    "attachments" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'uploaded',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "deleted_at" TEXT,
    "last_operation" TEXT NOT NULL,

    CONSTRAINT "auxop_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxop_ai_runs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "auxop_ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxop_vouchers" (
    "id" TEXT NOT NULL,
    "reservation_code" TEXT NOT NULL,
    "encrypted_data" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "deleted_at" TEXT,
    "last_operation" TEXT NOT NULL,

    CONSTRAINT "auxop_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxop_passwords" (
    "id" TEXT NOT NULL,
    "encrypted" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "auxop_passwords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxop_transfer_vouchers" (
    "id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "reservation_code" TEXT NOT NULL,
    "encrypted_data" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "deleted_at" TEXT,
    "last_operation" TEXT NOT NULL,

    CONSTRAINT "auxop_transfer_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxop_quick_replies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "html" TEXT NOT NULL DEFAULT '',
    "import_key" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updated_by" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "auxop_quick_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxop_flight_itineraries" (
    "id" TEXT NOT NULL,
    "reservation_code" TEXT NOT NULL,
    "encrypted_data" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "deleted_at" TEXT,
    "last_operation" TEXT NOT NULL,

    CONSTRAINT "auxop_flight_itineraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxop_transfer_requests" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "encrypted_data" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "created_by" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "sent_at" TEXT,
    "provider_id" TEXT,

    CONSTRAINT "auxop_transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxop_reservation_ai_runs" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "answer" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "auxop_reservation_ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxop_sac_ai_runs" (
    "id" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "auxop_sac_ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxop_hotel_catalog" (
    "id" TEXT NOT NULL,
    "reservation_code" TEXT NOT NULL,
    "operator_reference" TEXT NOT NULL DEFAULT '',
    "operator" TEXT NOT NULL DEFAULT '',
    "hotel_name" TEXT NOT NULL,
    "check_in" TEXT NOT NULL DEFAULT '',
    "contact_name" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL,
    "deleted_at" TEXT,

    CONSTRAINT "auxop_hotel_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_auxop_doc_reservation" ON "auxop_documents"("reservation_code");

-- CreateIndex
CREATE INDEX "idx_auxop_doc_updated" ON "auxop_documents"("updated_at");

-- CreateIndex
CREATE INDEX "idx_auxop_ai_day" ON "auxop_ai_runs"("day");

-- CreateIndex
CREATE INDEX "idx_auxop_ai_doc" ON "auxop_ai_runs"("document_id");

-- CreateIndex
CREATE INDEX "idx_auxop_voucher_reservation" ON "auxop_vouchers"("reservation_code");

-- CreateIndex
CREATE INDEX "idx_auxop_transfer_reservation" ON "auxop_transfer_vouchers"("reservation_code");

-- CreateIndex
CREATE INDEX "idx_auxop_transfer_destination" ON "auxop_transfer_vouchers"("destination");

-- CreateIndex
CREATE UNIQUE INDEX "idx_auxop_quick_import" ON "auxop_quick_replies"("import_key");

-- CreateIndex
CREATE INDEX "idx_auxop_flight_reservation" ON "auxop_flight_itineraries"("reservation_code");

-- CreateIndex
CREATE UNIQUE INDEX "idx_auxop_transfer_request_fingerprint" ON "auxop_transfer_requests"("fingerprint");

-- CreateIndex
CREATE INDEX "auxop_email_thread" ON "auxop_reservation_ai_runs"("thread_id", "by", "created_at");

-- CreateIndex
CREATE INDEX "auxop_hotel_avi" ON "auxop_hotel_catalog"("reservation_code");

-- AddForeignKey
ALTER TABLE "auxop_ai_runs" ADD CONSTRAINT "auxop_ai_runs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "auxop_documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
