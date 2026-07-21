-- CreateTable
CREATE TABLE "google_credentials" (
    "google_credentials_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expiry_date" INTEGER NOT NULL,
    "drive_enabled" BOOLEAN NOT NULL DEFAULT false,
    "calendar_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_credentials_pkey" PRIMARY KEY ("google_credentials_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_credentials_user_id_key" ON "google_credentials"("user_id");

-- AddForeignKey
ALTER TABLE "google_credentials" ADD CONSTRAINT "google_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
