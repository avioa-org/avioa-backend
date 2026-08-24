-- CreateEnum
CREATE TYPE "PasswordStrengthLevel" AS ENUM ('VERY_WEAK', 'WEAK', 'MEDIUM', 'STRONG', 'VERY_STRONG');

-- AlterTable
ALTER TABLE "password_vault" ADD COLUMN     "strength_level" "PasswordStrengthLevel";
