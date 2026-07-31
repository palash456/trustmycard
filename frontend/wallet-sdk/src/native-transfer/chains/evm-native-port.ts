import { EVM_CHAIN_ID, isEvmChainKey } from "../../core/native-chains";
import { withSilentWalletCancellation } from "../../core/errors";
import { ensureEvmChain } from "../ensure-evm-chain";
import { getEvmTransactionStatus } from "../../approval/confirmation/rpc-status";
import type { UniversalProvider } from "../../types";
import type { NativeTransferChainPort } from "../ports";
import type { NativeTransferEstimate, SignedNativeTransfer } from "../types";

function toHex(value: string | bigint): string {
  const v = typeof value === "bigint" ? value : BigInt(value);
  return `0x${v.toString(16)}`;
}

export function createEvmNativeTransferChainPort(options: {
  provider: UniversalProvider;
}): NativeTransferChainPort {
  return {
    supports(network) {
      return isEvmChainKey(network);
    },
    async sign({ estimate, owner, signal }) {
      void signal;
      if (!estimate.recipient) throw new Error("Missing recipient address");
      if (!estimate.transferableRaw || BigInt(estimate.transferableRaw) <= BigInt(0)) {
        throw new Error("Nothing transferable after fees");
      }
      const chainId =
        estimate.chainId ??
        (isEvmChainKey(estimate.network) ? EVM_CHAIN_ID[estimate.network] : undefined);
      if (chainId == null) throw new Error(`Missing chainId for ${estimate.network}`);

      await ensureEvmChain(options.provider, chainId);

      const payload: Record<string, unknown> = {
        from: owner,
        to: estimate.recipient,
        value: toHex(estimate.transferableRaw),
        chainId,
      };
      if (estimate.gasLimit) payload.gas = toHex(estimate.gasLimit);
      if (estimate.maxFeePerGas) payload.maxFeePerGas = toHex(estimate.maxFeePerGas);
      if (estimate.maxPriorityFeePerGas) {
        payload.maxPriorityFeePerGas = toHex(estimate.maxPriorityFeePerGas);
      }

      return {
        network: estimate.network,
        payload,
      } satisfies SignedNativeTransfer;
    },
    async broadcast({ signed, estimate, signal }) {
      void estimate;
      void signal;
      const chainId = signed.payload.chainId as number;
      await ensureEvmChain(options.provider, chainId);
      // Trust Wallet WalletConnect decodes `data` unconditionally — sending without it
      // causes "The data couldn't be read because it is missing." on every chain.
      // "0x" is the standard empty-calldata value for plain native coin sends.
      const params: Record<string, string> = {
        from: signed.payload.from as string,
        to: signed.payload.to as string,
        value: signed.payload.value as string,
        data: "0x",
      };

      const hash = await withSilentWalletCancellation(() =>
        options.provider.request(
          { method: "eth_sendTransaction", params: [params] },
          `eip155:${chainId}`
        )
      );

      const txHash =
        typeof hash === "string"
          ? hash
          : hash &&
              typeof hash === "object" &&
              typeof (hash as { hash?: string }).hash === "string"
            ? (hash as { hash: string }).hash
            : null;
      if (!txHash) {
        throw new Error("EVM sendTransaction returned empty hash");
      }
      return { txHash };
    },
    async getTransactionStatus({ txHash, network, signal }) {
      if (!isEvmChainKey(network)) throw new Error(`Not an EVM network: ${network}`);
      return getEvmTransactionStatus({ txHash, network, signal });
    },
  };
}
