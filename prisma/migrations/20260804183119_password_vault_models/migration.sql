-- CreateEnum
CREATE TYPE "PasswordAuditAction" AS ENUM ('CREATED', 'UPDATED', 'VIEWED', 'COPIED', 'DELETED');

-- CreateTable
CREATE TABLE "password_vault" (
    "password_vault_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "password_encrypted" TEXT NOT NULL,
    "website" TEXT,
    "notes" TEXT,
    "category_id" TEXT,
    "owner_id" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_vault_pkey" PRIMARY KEY ("password_vault_id")
);

-- CreateTable
CREATE TABLE "password_category" (
    "password_category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,

    CONSTRAINT "password_category_pkey" PRIMARY KEY ("password_category_id")
);

-- CreateTable
CREATE TABLE "password_permission" (
    "password_permission_id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "password_permission_pkey" PRIMARY KEY ("password_permission_id")
);

-- CreateTable
CREATE TABLE "password_audit" (
    "password_audit_id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "PasswordAuditAction" NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_audit_pkey" PRIMARY KEY ("password_audit_id")
);

-- CreateIndex
CREATE INDEX "password_vault_owner_id_idx" ON "password_vault"("owner_id");

-- AddForeignKey
ALTER TABLE "password_vault" ADD CONSTRAINT "password_vault_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_vault" ADD CONSTRAINT "password_vault_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "password_category"("password_category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_permission" ADD CONSTRAINT "password_permission_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "password_vault"("password_vault_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_permission" ADD CONSTRAINT "password_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_audit" ADD CONSTRAINT "password_audit_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "password_vault"("password_vault_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_audit" ADD CONSTRAINT "password_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
