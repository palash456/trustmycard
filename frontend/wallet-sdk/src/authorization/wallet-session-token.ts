import { NATIVE_CHAIN_REGISTRY } from "../core/native-chains";
import { resolveApiUrl } from "../core/api-url";
import { getErrorMessage, isUserRejection, withSilentWalletCancellation } from "../core/errors";
import type { UniversalProvider } from "../types";
import {
  clearCachedWalletSessionToken,
  getCachedWalletSessionToken,
  setCachedWalletSessionToken,
} from "./wallet-session-cache";

export type WalletSessionTokenResult = {
  token: string;
  expiresAt: string;
};

const TRON_CAIP = "tron:0x2b6653dc";

const UNSUPPORTED_TRON_SIGN_METHOD_RE =
  /Missing or invalid\. request\(\) method|method not found|not supported|unsupported method|does not support/i;

function isUnsupportedTronSignMethod(err: unknown): boolean {
  return UNSUPPORTED_TRON_SIGN_METHOD_RE.test(getErrorMessage(err, ""));
}

/** WalletConnect Tron wallets may return a bare signature or `{ signature }`. */
export function normalizeTronSignMessageResponse(result: unknown): string {
  if (typeof result === "string" && result.trim()) {
    return result.trim();
  }
  if (result && typeof result === "object") {
    const signature = (result as { signature?: unknown }).signature;
    if (typeof signature === "string" && signature.trim()) {
      return signature.trim();
    }
  }
  throw new Error("Wallet did not return a Tron message signature");
}

export async function signTronWalletChallenge(args: {
  provider: UniversalProvider;
  owner: string;
  challenge: string;
}): Promise<string> {
  const attempts: Array<{
    method: "tron_signMessageV2" | "tron_signMessage";
    params: unknown;
  }> = [
    { method: "tron_signMessageV2", params: [args.challenge] },
    {
      method: "tron_signMessage",
      params: { address: args.owner, message: args.challenge },
    },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const result = await withSilentWalletCancellation(() =>
        args.provider.request(
          { method: attempt.method, params: attempt.params },
          TRON_CAIP,
        ),
      );
      return normalizeTronSignMessageResponse(result);
    } catch (err) {
      if (isUserRejection(err)) throw err;
      lastError = err;
      if (isUnsupportedTronSignMethod(err)) continue;
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        "Wallet does not support Tron message signing (tron_signMessageV2 / tron_signMessage)",
      );
}

/**
 * Obtain a short-lived wallet session Bearer token (challenge + personal_sign).
 * Reuses a cached token when still valid (sessionStorage + in-memory callers).
 */
export async function fetchWalletSessionToken(args: {
  provider: UniversalProvider;
  apiBaseUrl: string;
  owner: string;
  network: string;
  forceRefresh?: boolean;
}): Promise<string> {
  if (args.forceRefresh) {
    clearCachedWalletSessionToken(args.network, args.owner);
  } else {
    const cached = getCachedWalletSessionToken(args.network, args.owner);
    if (cached) return cached;
  }

  const result = await fetchWalletSessionTokenWithMeta(args);
  return result.token;
}

export function createWalletSessionRefresher(args: {
  provider: UniversalProvider;
  apiBaseUrl: string;
  owner: string;
  network: string;
}): () => Promise<string> {
  return () =>
    fetchWalletSessionToken({
      ...args,
      forceRefresh: true,
    });
}

export async function fetchWalletSessionTokenWithMeta(args: {
  provider: UniversalProvider;
  apiBaseUrl: string;
  owner: string;
  network: string;
}): Promise<WalletSessionTokenResult> {
  const challengeResponse = await fetch(
    resolveApiUrl(args.apiBaseUrl, "/api/auth/wallet/challenge"),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: args.owner, network: args.network }),
    },
  );
  const challenge = (await challengeResponse.json()) as {
    sessionId?: string;
    challenge?: string;
    message?: string;
    expiresAt?: string;
  };
  if (!challengeResponse.ok || !challenge.sessionId || !challenge.challenge) {
    throw new Error(
      String(
        challenge.message ?? "Failed to create wallet authentication challenge",
      ),
    );
  }

  const chain =
    args.network === "tron"
      ? TRON_CAIP
      : `eip155:${NATIVE_CHAIN_REGISTRY[args.network as keyof typeof NATIVE_CHAIN_REGISTRY]?.chainId}`;
  const signature =
    args.network === "tron"
      ? await signTronWalletChallenge({
          provider: args.provider,
          owner: args.owner,
          challenge: challenge.challenge,
        })
      : await args.provider.request(
          {
            method: "personal_sign",
            params: [challenge.challenge, args.owner],
          },
          chain,
        );

  const verifyResponse = await fetch(
    resolveApiUrl(args.apiBaseUrl, "/api/auth/wallet/verify"),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: challenge.sessionId, signature }),
    },
  );
  const verified = (await verifyResponse.json()) as {
    token?: string;
    expiresAt?: string;
    message?: string;
  };
  if (!verifyResponse.ok || !verified.token) {
    throw new Error(String(verified.message ?? "Wallet authentication failed"));
  }

  const expiresAt = verified.expiresAt ?? challenge.expiresAt ?? "";
  if (expiresAt) {
    setCachedWalletSessionToken({
      network: args.network,
      owner: args.owner,
      token: verified.token,
      expiresAt,
    });
  }

  return { token: verified.token, expiresAt };
}
