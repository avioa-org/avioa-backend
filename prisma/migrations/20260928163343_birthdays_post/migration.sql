-- AlterEnum
ALTER TYPE "FeedPostType" ADD VALUE 'BIRTHDAY';

-- AlterEnum
ALTER TYPE "ReactionType" ADD VALUE 'BIRTHDAY';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "birthday_celebration_seen_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "birthday_template" (
    "model_birthday_template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "birthday_template_pkey" PRIMARY KEY ("model_birthday_template_id")
);
