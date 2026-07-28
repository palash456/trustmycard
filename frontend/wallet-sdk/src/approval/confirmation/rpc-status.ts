import { EVM_RPC } from "../../core/native-chains";
import { isEvmChainKey, type EvmChainKey } from "../../core/chain-tokens";
import {
  TransactionConfirmationStatus,
  type TransactionStatusSnapshot,
} from "../confirmation/types";

const TRON_GRID = "https://api.trongrid.io";

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
    `${TRON_GRID}/wallet/gettransactioninfobyid`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
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
  const rpc = EVM_RPC[args.network];
  if (!rpc) {
    throw new Error(`No RPC configured for network ${args.network}`);
  }

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
    return {
      status: TransactionConfirmationStatus.PENDING,
      txHash: args.txHash,
    };
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
