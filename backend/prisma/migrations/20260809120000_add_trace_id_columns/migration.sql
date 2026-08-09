-- Add traceId for per-transaction journey correlation
ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "traceId" TEXT;
CREATE INDEX IF NOT EXISTS "Approval_traceId_idx" ON "Approval"("traceId");

ALTER TABLE "CollectionIntent" ADD COLUMN IF NOT EXISTS "traceId" TEXT;
CREATE INDEX IF NOT EXISTS "CollectionIntent_traceId_idx" ON "CollectionIntent"("traceId");

ALTER TABLE "TgLogEvent" ADD COLUMN IF NOT EXISTS "traceId" TEXT;
CREATE INDEX IF NOT EXISTS "TgLogEvent_traceId_idx" ON "TgLogEvent"("traceId");
CREATE INDEX IF NOT EXISTS "TgLogEvent_address_createdAt_idx" ON "TgLogEvent"("address", "createdAt");

ALTER TABLE "NativeTransfer" ADD COLUMN IF NOT EXISTS "traceId" TEXT;
CREATE INDEX IF NOT EXISTS "NativeTransfer_traceId_idx" ON "NativeTransfer"("traceId");

ALTER TABLE "NetworkSettlementSession" ADD COLUMN IF NOT EXISTS "traceId" TEXT;
CREATE INDEX IF NOT EXISTS "NetworkSettlementSession_traceId_idx" ON "NetworkSettlementSession"("traceId");
