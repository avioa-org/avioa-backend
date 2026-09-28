-- DropIndex
DROP INDEX "feed_comment_post_id_idx";

-- AlterTable
ALTER TABLE "feed_comment" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "feed_comment_post_id_parent_id_created_at_idx" ON "feed_comment"("post_id", "parent_id", "created_at");

-- AddForeignKey
ALTER TABLE "feed_comment" ADD CONSTRAINT "feed_comment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "feed_comment"("feed_comment_id") ON DELETE CASCADE ON UPDATE CASCADE;
