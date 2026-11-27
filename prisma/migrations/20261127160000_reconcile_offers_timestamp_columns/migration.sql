-- Keep the existing offers data while restoring the String/TEXT types
-- declared by the Prisma models.
ALTER TABLE "offers_audit_history"
  ALTER COLUMN "created_at" TYPE TEXT USING "created_at"::TEXT;

ALTER TABLE "offers_workspace_state"
  ALTER COLUMN "updated_at" TYPE TEXT USING "updated_at"::TEXT;
