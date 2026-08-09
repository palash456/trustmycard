import { withSilentWalletCancellation } from "../../core/errors";
import { resolveApiUrl } from "../../core/api-url";
import {
  mergeTronSignedResult,
  tronSignTransaction,
} from "../../core/tron-sign";
import { getTronTransactionStatus } from "../../approval/confirmation/rpc-status";
import type { UniversalProvider } from "../../types";
import type { NativeTransferChainPort } from "../ports";
import type { SignedNativeTransfer } from "../types";

export function createTronNativeTransferChainPort(options: {
  provider: UniversalProvider;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}): NativeTransferChainPort {
  const fetchFn = options.fetchImpl ?? fetch;
  const apiBaseUrl = options.apiBaseUrl ?? "";

  return {
    supports(network) {
      return network === "tron";
    },
    async sign({ estimate, owner, signal }) {
      void signal;
      const unsigned = estimate.transaction;
      if (!unsigned)
        throw new Error(
          "Missing Tron native transfer transaction from estimate",
        );
      const signRaw = await withSilentWalletCancellation(() =>
        tronSignTransaction(options.provider, owner, unsigned),
      );
      const signed = mergeTronSignedResult(unsigned, signRaw);
      return {
        network: "tron",
        payload: { signed },
      } satisfies SignedNativeTransfer;
    },
    async broadcast({ signed, signal }) {
      const signedTx = signed.payload.signed as Record<string, unknown>;
      const res = await fetchFn(
        resolveApiUrl(apiBaseUrl, "/api/tron-broadcast"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(signedTx),
          cache: "no-store",
          signal,
        },
      );
      const json = (await res.json()) as {
        result?: boolean;
        txid?: string;
        error?: string;
        message?: string | null;
      };
      if (
        !res.ok ||
        json.result !== true ||
        typeof json.txid !== "string" ||
        !json.txid
      ) {
        throw new Error(
          json.error ||
            json.message ||
            "Tron broadcast was rejected by the node",
        );
      }
      return { txHash: json.txid };
    },
    async getTransactionStatus({ txHash, signal }) {
      return getTronTransactionStatus({ txHash, signal });
    },
  };
}
