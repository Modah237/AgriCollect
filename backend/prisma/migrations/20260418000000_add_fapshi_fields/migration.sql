-- Migration: Add Fapshi payment fields to PaymentBatch and PaymentLine
-- These columns were added to schema.prisma in the tRPC migration but
-- the database migration was never applied to production.

-- PaymentBatch: batch-level Fapshi reference
ALTER TABLE "payment_batches" ADD COLUMN IF NOT EXISTS "fapshiBatchRef" TEXT;

-- PaymentLine: individual transaction tracking
ALTER TABLE "payment_lines" ADD COLUMN IF NOT EXISTS "fapshiTxRef" TEXT;
ALTER TABLE "payment_lines" ADD COLUMN IF NOT EXISTS "fapshiStatus" TEXT;

-- Unique index on fapshiTxRef (mirrors @unique in schema.prisma)
CREATE UNIQUE INDEX IF NOT EXISTS "payment_lines_fapshiTxRef_key"
  ON "payment_lines"("fapshiTxRef");
