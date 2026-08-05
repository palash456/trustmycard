-- Store per-token shouldAttemptTransfer from wallet phase for native readiness policy
ALTER TABLE "NetworkSettlementSession" ADD COLUMN IF NOT EXISTS "tokenPlan" JSONB;
