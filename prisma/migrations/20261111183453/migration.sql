-- CreateTable
CREATE TABLE "FlightBlocking" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departDate" VARCHAR(10) NOT NULL,
    "returnDate" VARCHAR(10) NOT NULL,
    "departTime" TEXT NOT NULL,
    "returnTime" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "flight" TEXT NOT NULL,
    "capacity" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'manual',
    "drive" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "namesAt" TIMESTAMP(3),
    "namesBy" TEXT,
    "namesSignature" TEXT,
    "deletedAt" TIMESTAMP(3),
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightBlocking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightBlockingService" (
    "id" TEXT NOT NULL,
    "avi" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'tc',
    "data" JSONB NOT NULL,
    "sourceAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightBlockingService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightBlockingLink" (
    "serviceId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "seats" INTEGER,
    "signature" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightBlockingLink_pkey" PRIMARY KEY ("serviceId")
);

-- CreateTable
CREATE TABLE "FlightBlockingSplit" (
    "key" TEXT NOT NULL,
    "avi" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "splits" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightBlockingSplit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "FlightBlockingReview" (
    "key" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightBlockingReview_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "FlightBlockingAlert" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "due" VARCHAR(10) NOT NULL,
    "active" BOOLEAN NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightBlockingAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightBlockingAttachment" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "by" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightBlockingAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightBlockingEvent" (
    "id" TEXT NOT NULL,
    "blockId" TEXT,
    "serviceId" TEXT,
    "action" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "by" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightBlockingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightBlockingSync" (
    "id" INTEGER NOT NULL,
    "integrationAt" TIMESTAMP(3) NOT NULL,
    "lastSuccess" TIMESTAMP(3),
    "sheetCheckedAt" TIMESTAMP(3),
    "tcCheckedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "FlightBlockingSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlightBlocking_departDate_deletedAt_idx" ON "FlightBlocking"("departDate", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FlightBlocking_code_departDate_key" ON "FlightBlocking"("code", "departDate");

-- CreateIndex
CREATE INDEX "FlightBlockingService_avi_idx" ON "FlightBlockingService"("avi");

-- CreateIndex
CREATE INDEX "FlightBlockingSplit_avi_blockId_idx" ON "FlightBlockingSplit"("avi", "blockId");

-- CreateIndex
CREATE INDEX "FlightBlockingAlert_active_due_idx" ON "FlightBlockingAlert"("active", "due");

-- CreateIndex
CREATE UNIQUE INDEX "FlightBlockingAlert_blockId_kind_key" ON "FlightBlockingAlert"("blockId", "kind");

-- CreateIndex
CREATE INDEX "FlightBlockingAttachment_blockId_kind_idx" ON "FlightBlockingAttachment"("blockId", "kind");

-- CreateIndex
CREATE INDEX "FlightBlockingEvent_at_idx" ON "FlightBlockingEvent"("at");

-- AddForeignKey
ALTER TABLE "FlightBlockingLink" ADD CONSTRAINT "FlightBlockingLink_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "FlightBlockingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightBlockingLink" ADD CONSTRAINT "FlightBlockingLink_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "FlightBlocking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightBlockingAlert" ADD CONSTRAINT "FlightBlockingAlert_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "FlightBlocking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightBlockingAttachment" ADD CONSTRAINT "FlightBlockingAttachment_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "FlightBlocking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightBlockingEvent" ADD CONSTRAINT "FlightBlockingEvent_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "FlightBlocking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightBlockingEvent" ADD CONSTRAINT "FlightBlockingEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "FlightBlockingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
