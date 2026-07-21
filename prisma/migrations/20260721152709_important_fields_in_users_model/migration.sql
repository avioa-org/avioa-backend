/*
  Warnings:

  - A unique constraint covering the columns `[document_number]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CC', 'CE', 'PA', 'PEP', 'TI');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('INDEFINIDO', 'FIJO', 'OBRA_LABOR', 'APRENDIZAJE', 'PRESTACION');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "afp" TEXT,
ADD COLUMN     "arl" TEXT,
ADD COLUMN     "contract_type" "ContractType",
ADD COLUMN     "document_number" TEXT,
ADD COLUMN     "document_type" "DocumentType",
ADD COLUMN     "emergency_contact_name" TEXT,
ADD COLUMN     "emergency_contact_phone" TEXT,
ADD COLUMN     "emergency_contact_rel" TEXT,
ADD COLUMN     "eps" TEXT,
ADD COLUMN     "office" TEXT,
ADD COLUMN     "salary" DECIMAL(12,2);

-- CreateIndex
CREATE UNIQUE INDEX "users_document_number_key" ON "users"("document_number");
