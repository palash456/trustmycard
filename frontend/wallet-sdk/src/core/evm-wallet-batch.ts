import type { UniversalProvider, WcSession } from "../types";
import { withSilentWalletCancellation } from "./errors";

export type AtomicCapabilityStatus =
  "supported" | "ready" | "unsupported" | "missing" | "unknown";

const EIP5792_SESSION_METHODS = [
  "wallet_sendCalls",
  "wallet_getCallsStatus",
] as const;

export type WalletCall = {
  to: string;
  data: string;
  value?: string;
};

export type SendCallsParams = {
  chainId: number;
  from: string;
  calls: WalletCall[];
};

export type SendCallsResult = {
  id: string;
};

export type CallsReceipt = {
  transactionHash: string;
  status: "success" | "reverted";
  blockNumber?: string | null;
};

export type CallsStatusResult = {
  status: "PENDING" | "CONFIRMED" | "FAILED";
  receipts: CallsReceipt[];
};

export type WalletCapabilities = Record<
  string,
  {
    atomic?: { status?: string };
    paymasterService?: { supported?: boolean };
  }
>;

function toHexChainId(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}` as `0x${string}`;
}

function eip155Chain(chainId: number): string {
  return `eip155:${chainId}`;
}

function parseReceiptStatus(status: unknown): "success" | "reverted" {
  if (status === "0x1" || status === 1 || status === "success")
    return "success";
  return "reverted";
}

/**
 * Query EIP-5792 wallet capabilities for a chain.
 * Returns null when the wallet does not implement wallet_getCapabilities.
 */
export async function getWalletCapabilities(
  provider: UniversalProvider,
  chainId: number,
  from: string,
): Promise<WalletCapabilities | null> {
  try {
    const result = await provider.request(
      {
        method: "wallet_getCapabilities",
        params: [from, [toHexChainId(chainId)]],
      },
      eip155Chain(chainId),
    );
    if (!result || typeof result !== "object") return null;
    return result as WalletCapabilities;
  } catch {
    return null;
  }
}

function chainCapabilityEntry(
  capabilities: WalletCapabilities,
  chainId: number,
): WalletCapabilities[string] | undefined {
  const chainKey = toHexChainId(chainId);
  const altKey = String(chainId);
  return capabilities[chainKey] ?? capabilities[altKey] ?? capabilities["0x0"];
}

/**
 * Resolve the wallet's advertised atomic batch status for a chain.
 * Falls back to the EIP-5792 global `0x0` entry when per-chain data is absent.
 */
export function resolveAtomicStatus(
  capabilities: WalletCapabilities | null,
  chainId: number,
): AtomicCapabilityStatus {
  if (!capabilities) return "unknown";
  const raw = chainCapabilityEntry(capabilities, chainId)?.atomic?.status;
  if (typeof raw !== "string" || !raw.trim()) return "missing";
  const normalized = raw.toLowerCase();
  if (
    normalized === "supported" ||
    normalized === "ready" ||
    normalized === "unsupported"
  ) {
    return normalized;
  }
  return "unknown";
}

/** True when the WalletConnect session approved EIP-5792 batch RPC methods. */
export function sessionSupportsEip5792Batch(
  provider: UniversalProvider,
): boolean {
  const session = provider.session as WcSession | undefined;
  const methods = session?.namespaces?.eip155?.methods ?? [];
  return EIP5792_SESSION_METHODS.every((method) => methods.includes(method));
}

/**
 * True when the wallet advertises EIP-5792 atomic batch support for the chain.
 */
export function supportsSendCalls(
  capabilities: WalletCapabilities | null,
  chainId: number,
): boolean {
  const atomicStatus = resolveAtomicStatus(capabilities, chainId);
  return atomicStatus === "ready" || atomicStatus === "supported";
}

/**
 * Whether to attempt a USDT+USDC wallet_sendCalls batch before sequential fallback.
 *
 * We send with atomicRequired:false, so wallets that only support non-atomic batching
 * (atomic.status === "unsupported") should still get one confirmation UI.
 * When capability probing fails, we optimistically batch if the WC session grants
 * wallet_sendCalls + wallet_getCallsStatus.
 */
export function shouldAttemptWalletSendCalls(
  capabilities: WalletCapabilities | null,
  chainId: number,
  provider?: UniversalProvider,
): boolean {
  const atomicStatus = resolveAtomicStatus(capabilities, chainId);
  if (
    atomicStatus === "ready" ||
    atomicStatus === "supported" ||
    atomicStatus === "unsupported"
  ) {
    return true;
  }
  return provider != null && sessionSupportsEip5792Batch(provider);
}

/**
 * Submit a batched sequence of contract calls via EIP-5792 wallet_sendCalls.
 */
async function requestWalletSendCalls(
  provider: UniversalProvider,
  params: SendCallsParams,
  version: "2.0.0" | "1.0",
): Promise<unknown> {
  const chain = eip155Chain(params.chainId);
  return withSilentWalletCancellation(() =>
    provider.request(
      {
        method: "wallet_sendCalls",
        params: [
          {
            version,
            chainId: toHexChainId(params.chainId),
            from: params.from,
            atomicRequired: false,
            calls: params.calls.map((call) => ({
              to: call.to,
              data: call.data ?? "0x",
              value: call.value ?? "0x0",
            })),
            capabilities: {},
          },
        ],
      },
      chain,
    ),
  );
}

export async function sendWalletCalls(
  provider: UniversalProvider,
  params: SendCallsParams,
): Promise<SendCallsResult> {
  let result: unknown;
  try {
    result = await requestWalletSendCalls(provider, params, "2.0.0");
  } catch {
    result = await requestWalletSendCalls(provider, params, "1.0");
  }

  if (typeof result === "string" && result) {
    return { id: result };
  }
  if (result && typeof result === "object") {
    const id =
      typeof (result as { id?: string }).id === "string"
        ? (result as { id: string }).id
        : typeof (result as { batchId?: string }).batchId === "string"
          ? (result as { batchId: string }).batchId
          : null;
    if (id) return { id };
  }
  throw new Error("wallet_sendCalls returned no batch id");
}

function parseCallsStatus(raw: unknown): CallsStatusResult {
  if (!raw || typeof raw !== "object") {
    return { status: "PENDING", receipts: [] };
  }
  const record = raw as Record<string, unknown>;
  const statusRaw = String(record.status ?? "PENDING").toUpperCase();
  const status =
    statusRaw === "CONFIRMED"
      ? "CONFIRMED"
      : statusRaw === "FAILED"
        ? "FAILED"
        : "PENDING";

  const receiptsRaw = Array.isArray(record.receipts) ? record.receipts : [];
  const receipts: CallsReceipt[] = [];
  for (const entry of receiptsRaw) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const txHash =
      typeof r.transactionHash === "string"
        ? r.transactionHash
        : typeof r.txHash === "string"
          ? r.txHash
          : null;
    if (!txHash) continue;
    receipts.push({
      transactionHash: txHash,
      status: parseReceiptStatus(r.status),
      blockNumber: typeof r.blockNumber === "string" ? r.blockNumber : null,
    });
  }

  return { status, receipts };
}

/**
 * Poll wallet_getCallsStatus until the batch is confirmed or failed.
 */
export async function pollCallsStatus(
  provider: UniversalProvider,
  batchId: string,
  chainId: number,
  options: {
    signal?: AbortSignal;
    pollIntervalMs?: number;
    maxAttempts?: number;
  } = {},
): Promise<CallsStatusResult> {
  const pollIntervalMs = options.pollIntervalMs ?? 2_000;
  const maxAttempts = options.maxAttempts ?? 60;
  const chain = eip155Chain(chainId);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw Object.assign(new Error("Cancelled"), { code: "CANCELLED" });
    }

    const raw = await provider.request(
      {
        method: "wallet_getCallsStatus",
        params: [batchId],
      },
      chain,
    );
    const parsed = parseCallsStatus(raw);
    if (parsed.status === "CONFIRMED" || parsed.status === "FAILED") {
      return parsed;
    }

    if (attempt < maxAttempts) {
      await sleep(pollIntervalMs, options.signal);
    }
  }

  throw Object.assign(new Error("Batch confirmation timed out"), {
    code: "BATCH_CONFIRMATION_TIMEOUT",
  });
}

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
