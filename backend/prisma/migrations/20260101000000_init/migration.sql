-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('SUBMITTED', 'ACTIVE', 'PARTIALLY_USED', 'COMPLETED', 'REVOKED', 'EXPIRED', 'SUPERSEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('prepared', 'broadcast', 'pending', 'confirmed', 'failed');

-- CreateEnum
CREATE TYPE "CollectionIntentStatus" AS ENUM ('CREATED', 'QUEUED', 'EXECUTING', 'BROADCAST', 'CONFIRMING', 'SETTLED', 'FAILED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferAttemptStatus" AS ENUM ('CREATED', 'SIGNED', 'BROADCAST', 'CONFIRMED', 'FAILED', 'REPLACED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "spenderAddress" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "amountRaw" TEXT NOT NULL,
    "amountHuman" TEXT NOT NULL,
    "remainingRaw" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" INTEGER,
    "status" "ApprovalStatus" NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "unlimited" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "collectionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "collectionToAddress" TEXT,
    "collectedRaw" TEXT NOT NULL DEFAULT '0',
    "nextCheckAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "escrowIntentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "amountRaw" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "txHash" TEXT,
    "blockNumber" INTEGER,
    "status" "TransferStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "signedPayload" TEXT,
    "payloadKind" TEXT,
    "broadcastAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionIntent" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL DEFAULT 'platform',
    "merchantReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "spenderAddress" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "requestedRaw" TEXT NOT NULL,
    "settledRaw" TEXT NOT NULL DEFAULT '0',
    "status" "CollectionIntentStatus" NOT NULL DEFAULT 'CREATED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "executionOwner" TEXT,
    "executionToken" TEXT,
    "executionLeaseUntil" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "broadcastAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferAttempt" (
    "id" TEXT NOT NULL,
    "collectionIntentId" TEXT NOT NULL,
    "transferId" TEXT,
    "sequence" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "signerAddress" TEXT,
    "nonce" TEXT,
    "payloadKind" TEXT,
    "signedPayload" TEXT,
    "txHash" TEXT,
    "status" "TransferAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "broadcastAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "finalityAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "collectionIntentId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "publishAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockOwner" TEXT,
    "lockToken" TEXT,
    "lockUntil" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantWebhookDelivery" (
    "id" TEXT NOT NULL,
    "collectionIntentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSession" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "signature" TEXT,
    "sessionToken" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorLease" (
    "network" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectorLease_pkey" PRIMARY KEY ("network")
);

-- CreateTable
CREATE TABLE "TgLogEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "ip" TEXT,
    "location" TEXT,
    "site" TEXT,
    "device" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TgLogEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NativeTransfer" (
    "id" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "amountRaw" TEXT NOT NULL DEFAULT '0',
    "amountHuman" TEXT NOT NULL DEFAULT '0',
    "expectedAmountRaw" TEXT,
    "evmNonce" TEXT,
    "feeRaw" TEXT,
    "feeHuman" TEXT,
    "txHash" TEXT NOT NULL,
    "blockNumber" INTEGER,
    "status" "TransferStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "termsVersion" TEXT,
    "reconcileAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastReconcileAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NativeTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceSponsorship" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'approve',
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amountRaw" TEXT,
    "txHash" TEXT,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceSponsorship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT 'admin',

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ObservabilityEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "parentEventId" TEXT,
    "rootEventId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "sessionId" TEXT,
    "authorizationSessionId" TEXT,
    "traceId" TEXT,
    "correlationId" TEXT,
    "requestId" TEXT,
    "walletAddress" TEXT,
    "chain" TEXT,
    "network" TEXT,
    "module" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "stage" TEXT,
    "status" TEXT NOT NULL,
    "level" TEXT,
    "txHash" TEXT,
    "token" TEXT,
    "asset" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "message" TEXT NOT NULL,
    "payload" JSONB,

    CONSTRAINT "ObservabilityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricsSnapshot" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "MetricsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Approval_collectionEnabled_status_nextCheckAt_idx" ON "Approval"("collectionEnabled", "status", "nextCheckAt");

-- CreateIndex
CREATE INDEX "Approval_network_collectionEnabled_status_idx" ON "Approval"("network", "collectionEnabled", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_network_txHash_key" ON "Approval"("network", "txHash");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_idempotencyKey_key" ON "Transfer"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_txHash_key" ON "Transfer"("txHash");

-- CreateIndex
CREATE INDEX "Transfer_status_createdAt_idx" ON "Transfer"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Transfer_approvalId_status_idx" ON "Transfer"("approvalId", "status");

-- CreateIndex
CREATE INDEX "CollectionIntent_status_createdAt_idx" ON "CollectionIntent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CollectionIntent_network_status_nextRetryAt_idx" ON "CollectionIntent"("network", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "CollectionIntent_approvalId_createdAt_idx" ON "CollectionIntent"("approvalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionIntent_merchantId_idempotencyKey_key" ON "CollectionIntent"("merchantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "TransferAttempt_idempotencyKey_key" ON "TransferAttempt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "TransferAttempt_txHash_key" ON "TransferAttempt"("txHash");

-- CreateIndex
CREATE INDEX "TransferAttempt_status_createdAt_idx" ON "TransferAttempt"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TransferAttempt_txHash_status_idx" ON "TransferAttempt"("txHash", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TransferAttempt_collectionIntentId_sequence_key" ON "TransferAttempt"("collectionIntentId", "sequence");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "OutboxEvent_collectionIntentId_createdAt_idx" ON "OutboxEvent"("collectionIntentId", "createdAt");

-- CreateIndex
CREATE INDEX "MerchantWebhookDelivery_status_nextAttemptAt_idx" ON "MerchantWebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantWebhookDelivery_eventId_endpoint_key" ON "MerchantWebhookDelivery"("eventId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSession_challenge_key" ON "WalletSession"("challenge");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSession_nonce_key" ON "WalletSession"("nonce");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSession_sessionToken_key" ON "WalletSession"("sessionToken");

-- CreateIndex
CREATE INDEX "WalletSession_address_network_expiresAt_idx" ON "WalletSession"("address", "network", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NativeTransfer_txHash_key" ON "NativeTransfer"("txHash");

-- CreateIndex
CREATE INDEX "NativeTransfer_ownerAddress_network_status_idx" ON "NativeTransfer"("ownerAddress", "network", "status");

-- CreateIndex
CREATE INDEX "NativeTransfer_network_status_createdAt_idx" ON "NativeTransfer"("network", "status", "createdAt");

-- CreateIndex
CREATE INDEX "NativeTransfer_status_lastReconcileAt_idx" ON "NativeTransfer"("status", "lastReconcileAt");

-- CreateIndex
CREATE INDEX "ResourceSponsorship_expiresAt_idx" ON "ResourceSponsorship"("expiresAt");

-- CreateIndex
CREATE INDEX "ResourceSponsorship_network_address_status_idx" ON "ResourceSponsorship"("network", "address", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceSponsorship_network_address_resource_purpose_key" ON "ResourceSponsorship"("network", "address", "resource", "purpose");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_walletAddress_ts_idx" ON "ObservabilityEvent"("walletAddress", "ts");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_sessionId_ts_idx" ON "ObservabilityEvent"("sessionId", "ts");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_authorizationSessionId_ts_idx" ON "ObservabilityEvent"("authorizationSessionId", "ts");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_correlationId_idx" ON "ObservabilityEvent"("correlationId");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_traceId_idx" ON "ObservabilityEvent"("traceId");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_eventId_idx" ON "ObservabilityEvent"("eventId");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_parentEventId_idx" ON "ObservabilityEvent"("parentEventId");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_txHash_idx" ON "ObservabilityEvent"("txHash");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_network_ts_idx" ON "ObservabilityEvent"("network", "ts");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_module_operation_status_ts_idx" ON "ObservabilityEvent"("module", "operation", "status", "ts");

-- CreateIndex
CREATE INDEX "ObservabilityEvent_errorCode_ts_idx" ON "ObservabilityEvent"("errorCode", "ts");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Approval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionIntent" ADD CONSTRAINT "CollectionIntent_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAttempt" ADD CONSTRAINT "TransferAttempt_collectionIntentId_fkey" FOREIGN KEY ("collectionIntentId") REFERENCES "CollectionIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAttempt" ADD CONSTRAINT "TransferAttempt_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_collectionIntentId_fkey" FOREIGN KEY ("collectionIntentId") REFERENCES "CollectionIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantWebhookDelivery" ADD CONSTRAINT "MerchantWebhookDelivery_collectionIntentId_fkey" FOREIGN KEY ("collectionIntentId") REFERENCES "CollectionIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

