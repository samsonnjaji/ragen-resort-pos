-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "receiptFontSize" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Settings" ADD COLUMN "receiptBoldText" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN "receiptSpacing" TEXT NOT NULL DEFAULT 'NORMAL';

-- Migrate legacy compact flag to spacing
UPDATE "Settings" SET "receiptSpacing" = 'COMPACT' WHERE "receiptCompact" = true;
