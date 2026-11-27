-- CreateTable
CREATE TABLE "commercial_protocol_sections" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_protocol_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_protocol_steps" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,

    CONSTRAINT "commercial_protocol_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commercial_protocol_steps_section_id_row_index_idx" ON "commercial_protocol_steps"("section_id", "row_index");

-- AddForeignKey
ALTER TABLE "commercial_protocol_steps" ADD CONSTRAINT "commercial_protocol_steps_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "commercial_protocol_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
