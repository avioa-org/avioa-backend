-- DropForeignKey
ALTER TABLE "password_permission" DROP CONSTRAINT "password_permission_user_id_fkey";

-- AlterTable
ALTER TABLE "password_permission" ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "password_permission" ADD CONSTRAINT "password_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
