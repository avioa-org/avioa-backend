-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'CELEBRATE', 'SUPPORT', 'LOVE');

-- CreateEnum
CREATE TYPE "FeedPostType" AS ENUM ('PUBLICATION', 'RECOGNITION', 'ANNOUNCEMENT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "canPublishInFeed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "feed_post" (
    "feed_post_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "type" "FeedPostType" NOT NULL DEFAULT 'PUBLICATION',
    "content" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "recognized_user_id" TEXT,

    CONSTRAINT "feed_post_pkey" PRIMARY KEY ("feed_post_id")
);

-- CreateTable
CREATE TABLE "feed_reaction" (
    "feed_reaction_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL DEFAULT 'LIKE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_reaction_pkey" PRIMARY KEY ("feed_reaction_id")
);

-- CreateTable
CREATE TABLE "feed_comment" (
    "feed_comment_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "feed_comment_pkey" PRIMARY KEY ("feed_comment_id")
);

-- CreateIndex
CREATE INDEX "feed_post_createdAt_idx" ON "feed_post"("createdAt");

-- CreateIndex
CREATE INDEX "feed_post_type_idx" ON "feed_post"("type");

-- CreateIndex
CREATE UNIQUE INDEX "feed_reaction_post_id_user_id_key" ON "feed_reaction"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "feed_comment_post_id_idx" ON "feed_comment"("post_id");

-- AddForeignKey
ALTER TABLE "feed_post" ADD CONSTRAINT "feed_post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_post" ADD CONSTRAINT "feed_post_recognized_user_id_fkey" FOREIGN KEY ("recognized_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_reaction" ADD CONSTRAINT "feed_reaction_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed_post"("feed_post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_reaction" ADD CONSTRAINT "feed_reaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_comment" ADD CONSTRAINT "feed_comment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed_post"("feed_post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_comment" ADD CONSTRAINT "feed_comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
