/*
  Warnings:

  - You are about to drop the `offers_audit_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `offers_workspace_roles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `offers_workspace_state` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "offers_audit_history";

-- DropTable
DROP TABLE "offers_workspace_roles";

-- DropTable
DROP TABLE "offers_workspace_state";

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
