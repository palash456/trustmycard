import type {
  NativeTransferEstimate,
  NativeTransferRequest,
  SignedNativeTransfer,
} from "./types";
import type { TransactionStatusSnapshot } from "../approval/confirmation/types";

export type NativeTransferApiPort = {
  estimate(args: {
    request: NativeTransferRequest;
    signal?: AbortSignal;
  }): Promise<NativeTransferEstimate>;
  registerPending(args: {
    request: NativeTransferRequest;
    txHash: string;
    expectedAmountRaw: string;
    signal?: AbortSignal;
  }): Promise<{
    id: string;
    status: string;
    txHash: string;
    idempotent?: boolean;
  }>;
  confirm(args: {
    request: NativeTransferRequest;
    txHash: string;
    expectedAmountRaw: string;
    signal?: AbortSignal;
  }): Promise<{
    id: string;
    status: string;
    txHash: string;
    amountRaw: string;
    amountHuman: string;
    assetSymbol?: string;
    pending?: boolean;
  }>;
};

export type NativeTransferChainPort = {
  supports(network: string): boolean;
  sign(args: {
    estimate: NativeTransferEstimate;
    owner: string;
    signal?: AbortSignal;
    /** When true, prompt the wallet (eth_signTransaction) instead of building payload only. */
    interactive?: boolean;
  }): Promise<SignedNativeTransfer>;
  broadcast(args: {
    signed: SignedNativeTransfer;
    estimate: NativeTransferEstimate;
    signal?: AbortSignal;
    /** When true and signed payload includes raw hex, broadcast without wallet popup. */
    useRawBroadcast?: boolean;
  }): Promise<{ txHash: string }>;
  getTransactionStatus(args: {
    txHash: string;
    network: string;
    signal?: AbortSignal;
  }): Promise<TransactionStatusSnapshot>;
};
