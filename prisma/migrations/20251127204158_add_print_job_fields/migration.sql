-- AlterTable
ALTER TABLE "print_jobs" ADD COLUMN "receipt_data" JSONB,
ADD COLUMN "sent_at" TIMESTAMP(3),
ADD COLUMN "printed_at" TIMESTAMP(3);
