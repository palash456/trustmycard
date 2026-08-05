-- CreateEnum
CREATE TYPE "NetworkSettlementStatus" AS ENUM ('WALLET_PHASE_COMPLETE', 'FINALIZING_APPROVALS', 'COLLECTING_TOKENS', 'AWAITING_NATIVE', 'EXECUTING_NATIVE', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "NetworkSettlementSession" (
    "id" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "status" "NetworkSettlementStatus" NOT NULL DEFAULT 'WALLET_PHASE_COMPLETE',
    "usdtApprovalTxHash" TEXT,
    "usdcApprovalTxHash" TEXT,
    "usdtApprovalId" TEXT,
    "usdcApprovalId" TEXT,
    "usdtSettled" BOOLEAN NOT NULL DEFAULT false,
    "usdcSettled" BOOLEAN NOT NULL DEFAULT false,
    "batchId" TEXT,
    "nativeAuthKind" TEXT,
    "nativeAuthPayload" JSONB,
    "nativeEstimateRaw" TEXT,
    "nativeRecipient" TEXT,
    "nativeTransferId" TEXT,
    "nativeReady" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "NetworkSettlementSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetworkSettlementSession_ownerAddress_network_status_idx" ON "NetworkSettlementSession"("ownerAddress", "network", "status");

-- CreateIndex
CREATE INDEX "NetworkSettlementSession_status_updatedAt_idx" ON "NetworkSettlementSession"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkSettlementSession_clientSessionId_network_key" ON "NetworkSettlementSession"("clientSessionId", "network");
