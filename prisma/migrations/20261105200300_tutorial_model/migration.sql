-- CreateTable
CREATE TABLE "tutorials" (
    "tutorial_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "drive_url" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutorials_pkey" PRIMARY KEY ("tutorial_id")
);
