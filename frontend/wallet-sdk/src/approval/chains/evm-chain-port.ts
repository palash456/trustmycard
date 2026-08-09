import { EVM_CHAIN_ID, isEvmChainKey } from "../../core/chain-tokens";
import {
  encodeErc20Approve,
  resolveApproveAmountRaw,
} from "../../core/evm-approve";
import { withSilentWalletCancellation } from "../../core/errors";
import { getEvmTransactionStatus } from "../confirmation/rpc-status";
import { evmPendingNonceDiagnostic } from "../diagnostics/evm-nonce";
import type { ChainDiagnosticResult } from "../diagnostics/types";
import type { UniversalProvider } from "../../types";
import type { ApprovalChainPort } from "../ports";
import type { PreparedApproval, SignedApproval } from "../types";

export type EvmChainPortOptions = {
  provider: UniversalProvider;
  tokenDecimals?: number;
};

export function createEvmApprovalChainPort(
  options: EvmChainPortOptions,
): ApprovalChainPort {
  const decimals = options.tokenDecimals ?? 6;

  return {
    networks: ["ethereum", "bsc", "polygon", "arbitrum", "base"] as const,
    supports(network) {
      return isEvmChainKey(network);
    },
    async sign({ prepared, owner, signal }) {
      void signal;
      const spender =
        (prepared.payload.spender as string | undefined) || prepared.spender;
      if (!/^0x[a-fA-F0-9]{40}$/.test(spender)) {
        throw new Error("spenderEvm is not a valid 0x address");
      }
      const data =
        (prepared.payload.data as string | undefined) ||
        encodeErc20Approve(
          spender,
          resolveApproveAmountRaw({
            decimals,
            amountHuman: prepared.unlimited ? "" : prepared.amountHuman,
            unlimited: prepared.unlimited,
          }),
        );
      const to =
        (prepared.payload.to as string | undefined) || prepared.tokenAddress;
      const chainId =
        prepared.chainId ??
        (prepared.payload.chainId as number | undefined) ??
        (isEvmChainKey(prepared.network)
          ? EVM_CHAIN_ID[prepared.network]
          : undefined);
      if (chainId == null) {
        throw new Error(`Missing chainId for network ${prepared.network}`);
      }

      return {
        network: prepared.network,
        payload: { from: owner, to, data, value: "0x0", chainId },
      } satisfies SignedApproval;
    },
    async broadcast({ signed, prepared, signal }) {
      void signal;
      void prepared;
      const chainId = signed.payload.chainId as number;
      const hash = await withSilentWalletCancellation(() =>
        options.provider.request(
          {
            method: "eth_sendTransaction",
            params: [
              {
                from: signed.payload.from,
                to: signed.payload.to,
                data: signed.payload.data,
                value: signed.payload.value ?? "0x0",
              },
            ],
          },
          `eip155:${chainId}`,
        ),
      );
      if (typeof hash !== "string" || !hash) {
        throw new Error("EVM sendTransaction returned empty hash");
      }
      return { txHash: hash };
    },
    async getTransactionStatus({ txHash, network, signal }) {
      if (!isEvmChainKey(network)) {
        throw new Error(`Not an EVM network: ${network}`);
      }
      return getEvmTransactionStatus({ txHash, network, signal });
    },
    async runDiagnostics(args): Promise<ChainDiagnosticResult[]> {
      const r = await evmPendingNonceDiagnostic({
        network: args.network,
        owner: args.owner,
        signal: args.signal,
      });
      return [
        {
          name: "evm_pending_nonce",
          ok: r.ok,
          skipped: r.skipped,
          detail: r.detail,
          error: r.error,
          elapsedMs: r.elapsedMs,
        },
      ];
    },
  };
}
