-- CreateTable
CREATE TABLE "feed_comment_reaction" (
    "feed_comment_reaction_id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_comment_reaction_pkey" PRIMARY KEY ("feed_comment_reaction_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feed_comment_reaction_comment_id_user_id_key" ON "feed_comment_reaction"("comment_id", "user_id");

-- AddForeignKey
ALTER TABLE "feed_comment_reaction" ADD CONSTRAINT "feed_comment_reaction_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "feed_comment"("feed_comment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_comment_reaction" ADD CONSTRAINT "feed_comment_reaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
