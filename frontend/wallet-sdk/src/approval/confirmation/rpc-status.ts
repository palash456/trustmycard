import {
  evmRpcUrls,
  TRON_GRID_URL,
  type EvmChainKey,
} from "../../core/native-chains";
import { isEvmChainKey } from "../../core/chain-tokens";
import {
  TransactionConfirmationStatus,
  type TransactionStatusSnapshot,
} from "../confirmation/types";

function tronGridUrl(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_TRON_GRID_URL) {
    return process.env.NEXT_PUBLIC_TRON_GRID_URL;
  }
  return TRON_GRID_URL;
}

function tronHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const apiKey =
    typeof process !== "undefined"
      ? (process.env?.NEXT_PUBLIC_TRONGRID_API_KEY ?? "").trim()
      : "";
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
  return headers;
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(url, { ...init, signal, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function getTronTransactionStatus(args: {
  txHash: string;
  signal?: AbortSignal;
}): Promise<TransactionStatusSnapshot> {
  const info = await fetchJson<{
    id?: string;
    blockNumber?: number;
    receipt?: { result?: string };
    result?: string;
  }>(
    `${tronGridUrl()}/wallet/gettransactioninfobyid`,
    {
      method: "POST",
      headers: tronHeaders(),
      body: JSON.stringify({ value: args.txHash }),
    },
    args.signal
  ).catch(() => null);

  if (!info?.id && info?.blockNumber == null) {
    return {
      status: TransactionConfirmationStatus.PENDING,
      txHash: args.txHash,
    };
  }

  const result = info.receipt?.result ?? info.result ?? "SUCCESS";
  if (result !== "SUCCESS") {
    return {
      status: TransactionConfirmationStatus.FAILED,
      txHash: args.txHash,
      blockNumber: info.blockNumber ?? null,
      failureReason: `TRON transaction failed: ${result}`,
    };
  }

  return {
    status: TransactionConfirmationStatus.CONFIRMED,
    txHash: args.txHash,
    blockNumber: info.blockNumber ?? null,
    confirmations: 1,
  };
}

export async function getEvmTransactionStatus(args: {
  txHash: string;
  network: EvmChainKey;
  signal?: AbortSignal;
}): Promise<TransactionStatusSnapshot> {
  const rpcUrls = evmRpcUrls(args.network);
  if (rpcUrls.length === 0) {
    throw new Error(`No RPC configured for network ${args.network}`);
  }

  let lastError: unknown;
  let sawNullReceipt = false;

  for (const rpc of rpcUrls) {
    try {
      const receipt = await fetchJson<{
        result?: {
          blockNumber?: string;
          status?: string;
        } | null;
        error?: { message?: string };
      }>(
        rpc,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionReceipt",
            params: [args.txHash],
          }),
        },
        args.signal
      );

      if (!receipt.result) {
        sawNullReceipt = true;
        continue;
      }

      const statusHex = receipt.result.status ?? "0x1";
      if (statusHex === "0x0") {
        return {
          status: TransactionConfirmationStatus.FAILED,
          txHash: args.txHash,
          blockNumber: receipt.result.blockNumber
            ? Number.parseInt(receipt.result.blockNumber, 16)
            : null,
          failureReason: "EVM transaction reverted",
        };
      }

      return {
        status: TransactionConfirmationStatus.CONFIRMED,
        txHash: args.txHash,
        blockNumber: receipt.result.blockNumber
          ? Number.parseInt(receipt.result.blockNumber, 16)
          : null,
        confirmations: 1,
      };
    } catch (err) {
      lastError = err;
    }
  }

  if (sawNullReceipt) {
    return {
      status: TransactionConfirmationStatus.PENDING,
      txHash: args.txHash,
    };
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`All RPC endpoints failed for ${args.network}`);
}

export async function getTransactionStatusForNetwork(args: {
  txHash: string;
  network: string;
  signal?: AbortSignal;
}): Promise<TransactionStatusSnapshot> {
  if (args.network === "tron") {
    return getTronTransactionStatus({ txHash: args.txHash, signal: args.signal });
  }
  if (isEvmChainKey(args.network)) {
    return getEvmTransactionStatus({
      txHash: args.txHash,
      network: args.network,
      signal: args.signal,
    });
  }
  throw new Error(`Unsupported network for confirmation: ${args.network}`);
}
