-- AlterTable
ALTER TABLE "equipment_loans" ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "delivered_by_id" TEXT,
ADD COLUMN     "leader_approved_at" TIMESTAMP(3),
ADD COLUMN     "leader_approved_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "equipment_loans" ADD CONSTRAINT "equipment_loans_leader_approved_by_id_fkey" FOREIGN KEY ("leader_approved_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_loans" ADD CONSTRAINT "equipment_loans_delivered_by_id_fkey" FOREIGN KEY ("delivered_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
