-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "receiptAlignment" TEXT NOT NULL DEFAULT 'LEFT';
ALTER TABLE "Settings" ADD COLUMN "receiptCompact" BOOLEAN NOT NULL DEFAULT false;
