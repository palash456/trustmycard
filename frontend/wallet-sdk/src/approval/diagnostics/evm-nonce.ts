import type { EvmChainKey } from "../../core/chain-tokens";
import { isEvmChainKey } from "../../core/chain-tokens";
import { EVM_RPC } from "../../server/approvals/read-allowance";

/**
 * Lightweight EVM diagnostic: read pending nonce (operational signal only).
 * Never throws.
 */
export async function evmPendingNonceDiagnostic(args: {
  network: string;
  owner: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  detail?: { pendingNonce: number };
  error?: string;
  elapsedMs: number;
}> {
  const started = Date.now();
  if (!isEvmChainKey(args.network)) {
    return {
      ok: true,
      skipped: true,
      error: "not_evm",
      elapsedMs: Date.now() - started,
    };
  }
  const rpc = EVM_RPC[args.network as EvmChainKey];
  if (!rpc) {
    return {
      ok: true,
      skipped: true,
      error: "no_rpc",
      elapsedMs: Date.now() - started,
    };
  }
  const fetchFn = args.fetchImpl ?? fetch;
  try {
    const res = await fetchFn(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionCount",
        params: [args.owner, "pending"],
      }),
      cache: "no-store",
      signal: args.signal,
    });
    if (!res.ok) {
      return {
        ok: true,
        skipped: true,
        error: `http_${res.status}`,
        elapsedMs: Date.now() - started,
      };
    }
    const json = (await res.json()) as { result?: string; error?: { message?: string } };
    if (!json.result) {
      return {
        ok: true,
        skipped: true,
        error: json.error?.message ?? "no_result",
        elapsedMs: Date.now() - started,
      };
    }
    return {
      ok: true,
      detail: { pendingNonce: Number.parseInt(json.result, 16) },
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: true,
      skipped: true,
      error: err instanceof Error ? err.message : "nonce_read_failed",
      elapsedMs: Date.now() - started,
    };
  }
}
