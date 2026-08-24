-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "legal_entity" TEXT,
ALTER COLUMN "email" DROP NOT NULL;
