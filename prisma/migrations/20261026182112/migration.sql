-- CreateEnum
CREATE TYPE "CommercialResourceKind" AS ENUM ('offer', 'video', 'reply', 'protocol', 'rate', 'operator', 'document');

-- CreateTable
CREATE TABLE "commercial_resources" (
    "resource_id" TEXT NOT NULL,
    "kind" "CommercialResourceKind" NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "url" VARCHAR(2000) NOT NULL DEFAULT '',
    "category" VARCHAR(120) NOT NULL DEFAULT '',
    "origin" VARCHAR(80) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_resources_pkey" PRIMARY KEY ("resource_id")
);

-- CreateIndex
CREATE INDEX "commercial_resources_kind_idx" ON "commercial_resources"("kind");

-- CreateIndex
CREATE INDEX "commercial_resources_updatedAt_idx" ON "commercial_resources"("updatedAt");
