/*
  Warnings:

  - Added the required column `password_auth_tag` to the `password_vault` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password_iv` to the `password_vault` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "password_vault" ADD COLUMN     "password_auth_tag" TEXT NOT NULL,
ADD COLUMN     "password_iv" TEXT NOT NULL;
