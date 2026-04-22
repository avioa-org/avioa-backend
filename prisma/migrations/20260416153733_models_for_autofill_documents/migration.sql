-- CreateTable
CREATE TABLE "signatures" (
    "signature_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "file_url" TEXT,
    "base64" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("signature_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "signature_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "templates" (
    "template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT,
    "base64" TEXT,
    "fields" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("template_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_signature_id_fkey" FOREIGN KEY ("signature_id") REFERENCES "signatures"("signature_id") ON DELETE SET NULL ON UPDATE CASCADE;
