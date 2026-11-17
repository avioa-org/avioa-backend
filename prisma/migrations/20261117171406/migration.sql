-- CreateTable
CREATE TABLE "commercial_rate_tables" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headers" TEXT[],
    "notes" TEXT[],
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_rate_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_rate_rows" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,
    "cells" TEXT[],

    CONSTRAINT "commercial_rate_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_operators" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_operators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commercial_rate_tables_slug_key" ON "commercial_rate_tables"("slug");

-- CreateIndex
CREATE INDEX "commercial_rate_rows_table_id_row_index_idx" ON "commercial_rate_rows"("table_id", "row_index");

-- AddForeignKey
ALTER TABLE "commercial_rate_rows" ADD CONSTRAINT "commercial_rate_rows_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "commercial_rate_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
