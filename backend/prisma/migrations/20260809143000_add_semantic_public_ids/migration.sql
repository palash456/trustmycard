-- Semantic business-facing public IDs (internal CUID primary keys unchanged).

ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "publicId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Approval_publicId_key" ON "Approval"("publicId");

ALTER TABLE "Transfer" ADD COLUMN IF NOT EXISTS "publicId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Transfer_publicId_key" ON "Transfer"("publicId");

ALTER TABLE "CollectionIntent" ADD COLUMN IF NOT EXISTS "publicId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CollectionIntent_publicId_key" ON "CollectionIntent"("publicId");

ALTER TABLE "NativeTransfer" ADD COLUMN IF NOT EXISTS "publicId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "NativeTransfer_publicId_key" ON "NativeTransfer"("publicId");

ALTER TABLE "NetworkSettlementSession" ADD COLUMN IF NOT EXISTS "publicId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "NetworkSettlementSession_publicId_key" ON "NetworkSettlementSession"("publicId");
