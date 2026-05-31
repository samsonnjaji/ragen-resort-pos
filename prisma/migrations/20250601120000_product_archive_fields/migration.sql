-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Product_archivedById_fkey'
  ) THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_archivedById_fkey"
      FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
