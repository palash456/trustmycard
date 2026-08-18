import { evmRpcUrls, type EvmChainKey } from "../../core/native-chains";
import { normalizeEvmSignedRaw } from "./evm-signed-raw";

async function evmRpcCall<T>(
  network: EvmChainKey,
  method: string,
  params: unknown[],
  signal?: AbortSignal,
): Promise<T> {
  const rpcUrls = evmRpcUrls(network);
  if (rpcUrls.length === 0) {
    throw new Error(`No RPC configured for network ${network}`);
  }

  let lastError: unknown;
  for (const rpc of rpcUrls) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
        cache: "no-store",
        signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        result?: T;
        error?: { message?: string };
      };
      if (json.error?.message) {
        throw new Error(json.error.message);
      }
      return json.result as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "EVM RPC call failed"));
}

export async function getEvmTransactionCount(args: {
  network: EvmChainKey;
  owner: string;
  signal?: AbortSignal;
  /** Default `pending` so deferred native signs after in-flight approvals get a fresh nonce. */
  blockTag?: "latest" | "pending";
}): Promise<bigint> {
  const hex = await evmRpcCall<string>(
    args.network,
    "eth_getTransactionCount",
    [args.owner, args.blockTag ?? "pending"],
    args.signal,
  );
  return BigInt(hex);
}

export async function broadcastEvmRawTransaction(args: {
  network: EvmChainKey;
  signedRaw: string;
  signal?: AbortSignal;
}): Promise<string> {
  // Defense in depth: unwrap Trust Wallet protobuf if a stored payload skipped normalize-at-sign.
  const raw = normalizeEvmSignedRaw(args.signedRaw);
  const hash = await evmRpcCall<string>(
    args.network,
    "eth_sendRawTransaction",
    [raw],
    args.signal,
  );
  if (!hash || typeof hash !== "string") {
    throw new Error("eth_sendRawTransaction returned empty hash");
  }
  return hash;
}
