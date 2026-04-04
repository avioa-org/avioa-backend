-- AlterEnum
ALTER TYPE "EstadoPT" ADD VALUE 'REVISION';

-- AlterTable
ALTER TABLE "hilos_pago_total" ADD COLUMN     "sync_sheet" BOOLEAN NOT NULL DEFAULT false;
