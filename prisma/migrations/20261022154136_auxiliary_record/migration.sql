-- CreateTable
CREATE TABLE "auxiliary_records" (
    "auxiliary_record_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "sealed" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "auxiliary_records_pkey" PRIMARY KEY ("auxiliary_record_id")
);

-- CreateIndex
CREATE INDEX "auxiliary_records_kind_archived_at_idx" ON "auxiliary_records"("kind", "archived_at");

-- CreateIndex
CREATE INDEX "auxiliary_records_reference_idx" ON "auxiliary_records"("reference");

-- AddForeignKey
ALTER TABLE "auxiliary_records" ADD CONSTRAINT "auxiliary_records_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
