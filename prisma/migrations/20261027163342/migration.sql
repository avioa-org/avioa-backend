-- CreateTable
CREATE TABLE "commercial_videos" (
    "video_id" TEXT NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "url" VARCHAR(2000) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'db',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_videos_pkey" PRIMARY KEY ("video_id")
);

-- CreateIndex
CREATE INDEX "commercial_videos_source_idx" ON "commercial_videos"("source");

-- CreateIndex
CREATE INDEX "commercial_videos_updated_at_idx" ON "commercial_videos"("updated_at");
