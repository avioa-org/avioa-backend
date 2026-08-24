/*
  Warnings:

  - The values [COPIED] on the enum `PasswordAuditAction` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PasswordAuditAction_new" AS ENUM ('CREATED', 'UPDATED', 'VIEWED', 'COPIED_USERNAME', 'COPIED_PASSWORD', 'DELETED', 'RESTORED', 'SHARED', 'PERMISSION_CHANGED');
ALTER TABLE "password_audit" ALTER COLUMN "action" TYPE "PasswordAuditAction_new" USING ("action"::text::"PasswordAuditAction_new");
ALTER TYPE "PasswordAuditAction" RENAME TO "PasswordAuditAction_old";
ALTER TYPE "PasswordAuditAction_new" RENAME TO "PasswordAuditAction";
DROP TYPE "public"."PasswordAuditAction_old";
COMMIT;

-- AlterTable
ALTER TABLE "password_permission" ADD COLUMN     "can_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "department_id" TEXT;

-- AlterTable
ALTER TABLE "password_vault" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "rotation_days" INTEGER;

-- CreateTable
CREATE TABLE "password_tags" (
    "password_tag_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "password_tags_pkey" PRIMARY KEY ("password_tag_id")
);

-- CreateTable
CREATE TABLE "passsword_tag_on_vault" (
    "vault_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "passsword_tag_on_vault_pkey" PRIMARY KEY ("vault_id","tag_id")
);

-- CreateTable
CREATE TABLE "password_version" (
    "password_version_id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "password_iv" TEXT NOT NULL,
    "password_auth_tag" TEXT NOT NULL,
    "changed_fields" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_version_pkey" PRIMARY KEY ("password_version_id")
);

-- CreateTable
CREATE TABLE "password_attachment" (
    "password_attachment_id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT,
    "file_size_bytes" INTEGER,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_attachment_pkey" PRIMARY KEY ("password_attachment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_tags_name_key" ON "password_tags"("name");

-- CreateIndex
CREATE INDEX "password_version_vault_id_idx" ON "password_version"("vault_id");

-- CreateIndex
CREATE INDEX "password_attachment_vault_id_idx" ON "password_attachment"("vault_id");

-- CreateIndex
CREATE INDEX "password_audit_vault_id_idx" ON "password_audit"("vault_id");

-- CreateIndex
CREATE INDEX "password_audit_user_id_idx" ON "password_audit"("user_id");

-- CreateIndex
CREATE INDEX "password_permission_vault_id_idx" ON "password_permission"("vault_id");

-- CreateIndex
CREATE INDEX "password_permission_user_id_idx" ON "password_permission"("user_id");

-- CreateIndex
CREATE INDEX "password_permission_department_id_idx" ON "password_permission"("department_id");

-- AddForeignKey
ALTER TABLE "passsword_tag_on_vault" ADD CONSTRAINT "passsword_tag_on_vault_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "password_vault"("password_vault_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passsword_tag_on_vault" ADD CONSTRAINT "passsword_tag_on_vault_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "password_tags"("password_tag_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_version" ADD CONSTRAINT "password_version_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "password_vault"("password_vault_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_attachment" ADD CONSTRAINT "password_attachment_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "password_vault"("password_vault_id") ON DELETE RESTRICT ON UPDATE CASCADE;
