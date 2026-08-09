import { withSilentWalletCancellation } from "../../core/errors";
import {
  mergeTronSignedResult,
  tronSignTransaction,
} from "../../core/tron-sign";
import { resolveApiUrl } from "../../core/api-url";
import { getTronTransactionStatus } from "../confirmation/rpc-status";
import { tronGetSignWeightDiagnostic } from "../diagnostics/tron-getsignweight";
import type { ChainDiagnosticResult } from "../diagnostics/types";
import type { UniversalProvider } from "../../types";
import type { ApprovalChainPort } from "../ports";
import type { PreparedApproval, SignedApproval } from "../types";

export type TronChainPortOptions = {
  provider: UniversalProvider;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
};

/**
 * TRON-specific sign + broadcast. Orchestrator stays chain-agnostic.
 */
export function createTronApprovalChainPort(
  options: TronChainPortOptions,
): ApprovalChainPort {
  const apiBaseUrl = options.apiBaseUrl ?? "";
  const fetchFn = options.fetchImpl ?? fetch;

  return {
    networks: ["tron"] as const,
    supports(network) {
      return network === "tron";
    },
    async sign({ prepared, owner, signal }) {
      void signal;
      const unsigned = prepared.payload.transaction as
        Record<string, unknown> | undefined;
      if (!unsigned) {
        throw new Error("Missing Tron transaction from prepare");
      }
      const signRaw = await withSilentWalletCancellation(() =>
        tronSignTransaction(options.provider, owner, unsigned),
      );
      const signed = mergeTronSignedResult(unsigned, signRaw);
      return {
        network: "tron",
        payload: { signed },
      } satisfies SignedApproval;
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
            "Tron broadcast was rejected by the node (no on-chain transaction)",
        );
      }
      return { txHash: json.txid };
    },
    async getTransactionStatus({ txHash, signal }) {
      return getTronTransactionStatus({ txHash, signal });
    },
    async runDiagnostics(args): Promise<ChainDiagnosticResult[]> {
      const unsigned =
        (args.signed?.payload.signed as Record<string, unknown> | undefined) ??
        (args.prepared?.payload.transaction as
          Record<string, unknown> | undefined);
      const r = await tronGetSignWeightDiagnostic({
        transaction: unsigned,
        signal: args.signal,
        fetchImpl: fetchFn,
      });
      return [
        {
          name: "tron_getSignWeight",
          ok: r.ok,
          skipped: r.skipped,
          detail: r.detail as Record<string, unknown> | undefined,
          error: r.error,
          elapsedMs: r.elapsedMs,
        },
      ];
    },
  };
}

/** Helper for tests / adapters that only need payload shape. */
export function tronPreparedFromUnsigned(
  unsigned: Record<string, unknown>,
  extras: Partial<PreparedApproval> = {},
): PreparedApproval {
  return {
    network: "tron",
    owner: extras.owner ?? "",
    spender: extras.spender ?? "",
    token: extras.token ?? "USDT",
    tokenAddress: extras.tokenAddress ?? "",
    amountRaw: extras.amountRaw ?? "0",
    amountHuman: extras.amountHuman ?? "0",
    unlimited: extras.unlimited ?? false,
    payload: { transaction: unsigned },
    preparedTxId: typeof unsigned.txID === "string" ? unsigned.txID : undefined,
    ...extras,
  };
}
