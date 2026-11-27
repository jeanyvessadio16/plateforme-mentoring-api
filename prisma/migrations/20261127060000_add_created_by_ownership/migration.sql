-- AlterTable
ALTER TABLE "Masterclass" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Masterclass_createdById_idx" ON "Masterclass"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Opportunity_createdById_idx" ON "Opportunity"("createdById");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Masterclass_createdById_fkey'
  ) THEN
    ALTER TABLE "Masterclass"
      ADD CONSTRAINT "Masterclass_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Opportunity_createdById_fkey'
  ) THEN
    ALTER TABLE "Opportunity"
      ADD CONSTRAINT "Opportunity_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
