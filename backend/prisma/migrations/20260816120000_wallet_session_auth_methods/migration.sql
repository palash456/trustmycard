-- Wallet session auth methods: personal_sign | tx_verified | settlement_scoped
ALTER TABLE "WalletSession" ADD COLUMN IF NOT EXISTS "authMethod" TEXT NOT NULL DEFAULT 'personal_sign';
ALTER TABLE "WalletSession" ADD COLUMN IF NOT EXISTS "scopeClientSessionId" TEXT;
ALTER TABLE "WalletSession" ADD COLUMN IF NOT EXISTS "proofTxHash" TEXT;

CREATE INDEX IF NOT EXISTS "WalletSession_scopeClientSessionId_idx" ON "WalletSession"("scopeClientSessionId");
