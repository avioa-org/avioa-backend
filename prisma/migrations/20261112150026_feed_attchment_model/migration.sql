-- CreateEnum
CREATE TYPE "FeedAttachmentType" AS ENUM ('IMAGE', 'FILE');

-- AlterTable
ALTER TABLE "knowledge_file" ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "storage_key" TEXT,
ALTER COLUMN "drive_url" DROP NOT NULL;

-- CreateTable
CREATE TABLE "feed_attchment" (
    "feed_attachment_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "type" "FeedAttachmentType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_attchment_pkey" PRIMARY KEY ("feed_attachment_id")
);

-- CreateIndex
CREATE INDEX "feed_attchment_post_id_idx" ON "feed_attchment"("post_id");

-- AddForeignKey
ALTER TABLE "feed_attchment" ADD CONSTRAINT "feed_attchment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed_post"("feed_post_id") ON DELETE CASCADE ON UPDATE CASCADE;
