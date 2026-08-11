import { isEvmChainKey, type EvmChainKey } from "./native-chains";
import { getEvmTransactionCount } from "../native-transfer/chains/evm-rpc";

const DEFAULT_POLL_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 20_000;
const TX_VISIBLE_TIMEOUT_MS = 15_000;
const NONCE_FALLBACK_TIMEOUT_MS = 3_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("Cancelled"), { code: "CANCELLED" }));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(Object.assign(new Error("Cancelled"), { code: "CANCELLED" }));
      },
      { once: true },
    );
  });
}

async function evmRpcCall<T>(
  network: EvmChainKey,
  method: string,
  params: unknown[],
  signal?: AbortSignal,
): Promise<T | null> {
  const { evmRpcUrls } = await import("./native-chains");
  const rpcUrls = evmRpcUrls(network);
  for (const rpc of rpcUrls) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        cache: "no-store",
        signal,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        result?: T;
        error?: { message?: string };
      };
      if (json.error?.message) continue;
      return json.result ?? null;
    } catch {
      continue;
    }
  }
  return null;
}

export async function readEvmPendingNonce(args: {
  network: string;
  owner: string;
  signal?: AbortSignal;
}): Promise<bigint | null> {
  if (!isEvmChainKey(args.network)) return null;
  try {
    return await getEvmTransactionCount({
      network: args.network as EvmChainKey,
      owner: args.owner,
      blockTag: "pending",
      signal: args.signal,
    });
  } catch {
    return null;
  }
}

async function waitForEvmTxVisible(args: {
  network: string;
  txHash: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<boolean> {
  if (!isEvmChainKey(args.network) || !args.txHash.startsWith("0x")) {
    return false;
  }
  const deadline = Date.now() + (args.timeoutMs ?? TX_VISIBLE_TIMEOUT_MS);
  const network = args.network as EvmChainKey;

  while (Date.now() < deadline) {
    if (args.signal?.aborted) {
      throw Object.assign(new Error("Cancelled"), { code: "CANCELLED" });
    }
    const tx = await evmRpcCall<{ hash?: string }>(
      network,
      "eth_getTransactionByHash",
      [args.txHash],
      args.signal,
    );
    if (tx && typeof tx === "object") {
      return true;
    }
    await sleep(DEFAULT_POLL_MS, args.signal);
  }
  return false;
}

/**
 * Wait until the account pending nonce advances past `baselineNonce`.
 * Prevents sequential wallet popups from reusing a stale nonce (Trust Wallet / WC).
 */
export async function waitForEvmPendingNonceAdvance(args: {
  network: string;
  owner: string;
  baselineNonce: bigint;
  signal?: AbortSignal;
  pollMs?: number;
  timeoutMs?: number;
}): Promise<bigint> {
  if (!isEvmChainKey(args.network)) {
    return args.baselineNonce;
  }

  const pollMs = args.pollMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + (args.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  while (Date.now() < deadline) {
    if (args.signal?.aborted) {
      throw Object.assign(new Error("Cancelled"), { code: "CANCELLED" });
    }

    const pending = await readEvmPendingNonce({
      network: args.network,
      owner: args.owner,
      signal: args.signal,
    });
    if (pending != null && pending > args.baselineNonce) {
      return pending;
    }

    await sleep(pollMs, args.signal);
  }

  throw new Error(
    "Previous approval transaction is still pending — nonce did not advance in time",
  );
}

/**
 * Gap between sequential EVM approval broadcasts so the wallet assigns a fresh nonce.
 * Waits for the prior tx to appear on RPC, then for pending nonce to advance.
 */
export async function awaitEvmSequentialApprovalGap(args: {
  network: string;
  owner: string;
  txHash: string;
  baselineNonce: bigint;
  signal?: AbortSignal;
}): Promise<bigint | null> {
  if (!isEvmChainKey(args.network)) return null;

  const txVisible = await waitForEvmTxVisible({
    network: args.network,
    txHash: args.txHash,
    signal: args.signal,
  });

  if (!txVisible) {
    try {
      return await waitForEvmPendingNonceAdvance({
        network: args.network,
        owner: args.owner,
        baselineNonce: args.baselineNonce,
        signal: args.signal,
        timeoutMs: NONCE_FALLBACK_TIMEOUT_MS,
      });
    } catch {
      return null;
    }
  }

  try {
    return await waitForEvmPendingNonceAdvance({
      network: args.network,
      owner: args.owner,
      baselineNonce: args.baselineNonce,
      signal: args.signal,
    });
  } catch {
    return null;
  }
}
