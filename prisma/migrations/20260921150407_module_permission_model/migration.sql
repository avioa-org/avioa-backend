-- CreateTable
CREATE TABLE "module_permissions" (
    "module_permission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "can_access" BOOLEAN NOT NULL DEFAULT true,
    "granted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_permissions_pkey" PRIMARY KEY ("module_permission_id")
);

-- CreateIndex
CREATE INDEX "module_permissions_user_id_idx" ON "module_permissions"("user_id");

-- CreateIndex
CREATE INDEX "module_permissions_module_idx" ON "module_permissions"("module");

-- CreateIndex
CREATE UNIQUE INDEX "module_permissions_user_id_module_key" ON "module_permissions"("user_id", "module");

-- AddForeignKey
ALTER TABLE "module_permissions" ADD CONSTRAINT "module_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
