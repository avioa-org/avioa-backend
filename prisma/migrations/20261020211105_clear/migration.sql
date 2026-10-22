-- RenameForeignKey
ALTER TABLE "transfer_email_deliveries" RENAME CONSTRAINT "transfer_email_deliveries_request_fkey" TO "transfer_email_deliveries_transfer_request_id_fkey";

-- RenameForeignKey
ALTER TABLE "transfer_whatsapp_deliveries" RENAME CONSTRAINT "transfer_whatsapp_deliveries_request_fkey" TO "transfer_whatsapp_deliveries_transfer_request_id_fkey";
