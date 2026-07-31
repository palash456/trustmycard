import { NATIVE_CHAIN_REGISTRY } from "../core/native-chains";
import { resolveApiUrl } from "../core/api-url";
import type { UniversalProvider } from "../types";
import {
  getCachedWalletSessionToken,
  setCachedWalletSessionToken,
} from "./wallet-session-cache";

export type WalletSessionTokenResult = {
  token: string;
  expiresAt: string;
};

/**
 * Obtain a short-lived wallet session Bearer token (challenge + personal_sign).
 * Reuses a cached token when still valid (sessionStorage + in-memory callers).
 */
export async function fetchWalletSessionToken(args: {
  provider: UniversalProvider;
  apiBaseUrl: string;
  owner: string;
  network: string;
}): Promise<string> {
  const cached = getCachedWalletSessionToken(args.network, args.owner);
  if (cached) return cached;

  const result = await fetchWalletSessionTokenWithMeta(args);
  return result.token;
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
    }
  );
  const challenge = (await challengeResponse.json()) as {
    sessionId?: string;
    challenge?: string;
    message?: string;
    expiresAt?: string;
  };
  if (!challengeResponse.ok || !challenge.sessionId || !challenge.challenge) {
    throw new Error(
      String(challenge.message ?? "Failed to create wallet authentication challenge")
    );
  }

  const chain =
    args.network === "tron"
      ? "tron:0x2b6653dc"
      : `eip155:${NATIVE_CHAIN_REGISTRY[args.network as keyof typeof NATIVE_CHAIN_REGISTRY]?.chainId}`;
  const method = args.network === "tron" ? "tron_signMessageV2" : "personal_sign";
  const params =
    args.network === "tron"
      ? [challenge.challenge]
      : [challenge.challenge, args.owner];
  const signature = await args.provider.request({ method, params }, chain);

  const verifyResponse = await fetch(
    resolveApiUrl(args.apiBaseUrl, "/api/auth/wallet/verify"),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: challenge.sessionId, signature }),
    }
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
