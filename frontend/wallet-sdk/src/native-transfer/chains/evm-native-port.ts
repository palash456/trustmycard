import {
  EVM_CHAIN_ID,
  isEvmChainKey,
  isEvmLegacyGasNetwork,
  type EvmChainKey,
} from "../../core/native-chains";
import { withSilentWalletCancellation } from "../../core/errors";
import { ensureEvmChain } from "../ensure-evm-chain";
import { getEvmTransactionStatus } from "../../approval/confirmation/rpc-status";
import type { UniversalProvider } from "../../types";
import type { NativeTransferChainPort } from "../ports";
import type { NativeTransferEstimate, SignedNativeTransfer } from "../types";
import { buildEvmSendTransactionParams } from "./evm-send-params";
import { normalizeEvmSignedRaw } from "./evm-signed-raw";
import {
  broadcastEvmRawTransaction,
  getEvmTransactionCount,
} from "./evm-rpc";

function toHex(value: string | bigint): string {
  const v = typeof value === "bigint" ? value : BigInt(value);
  return `0x${v.toString(16)}`;
}

function resolveChainId(
  estimate: NativeTransferEstimate,
): number | undefined {
  if (estimate.chainId != null) return estimate.chainId;
  if (isEvmChainKey(estimate.network)) {
    return EVM_CHAIN_ID[estimate.network];
  }
  return undefined;
}

async function buildEvmSignTransactionParams(args: {
  estimate: NativeTransferEstimate;
  owner: string;
  signal?: AbortSignal;
}): Promise<Record<string, string>> {
  const chainId = resolveChainId(args.estimate);
  if (chainId == null) {
    throw new Error(`Missing chainId for ${args.estimate.network}`);
  }
  if (!args.estimate.recipient) throw new Error("Missing recipient address");
  if (
    !args.estimate.transferableRaw ||
    BigInt(args.estimate.transferableRaw) <= BigInt(0)
  ) {
    throw new Error("Nothing transferable after fees");
  }
  if (!isEvmChainKey(args.estimate.network)) {
    throw new Error(`Not an EVM network: ${args.estimate.network}`);
  }

  const network = args.estimate.network as EvmChainKey;
  const nonce = await getEvmTransactionCount({
    network,
    owner: args.owner,
    signal: args.signal,
  });

  const params: Record<string, string> = {
    from: args.owner,
    to: args.estimate.recipient,
    value: toHex(args.estimate.transferableRaw),
    nonce: toHex(nonce),
    chainId: toHex(BigInt(chainId)),
  };

  if (args.estimate.gasLimit) {
    params.gas = toHex(args.estimate.gasLimit);
  }

  if (isEvmLegacyGasNetwork(network)) {
    if (args.estimate.maxFeePerGas) {
      params.gasPrice = toHex(args.estimate.maxFeePerGas);
    }
    return params;
  }

  params.data = "0x";
  if (args.estimate.maxFeePerGas) {
    params.maxFeePerGas = toHex(args.estimate.maxFeePerGas);
  }
  if (args.estimate.maxPriorityFeePerGas) {
    params.maxPriorityFeePerGas = toHex(args.estimate.maxPriorityFeePerGas);
  }

  return params;
}

export function createEvmNativeTransferChainPort(options: {
  provider: UniversalProvider;
}): NativeTransferChainPort {
  return {
    supports(network) {
      return isEvmChainKey(network);
    },
    async sign({ estimate, owner, signal, interactive }) {
      const chainId = resolveChainId(estimate);
      if (chainId == null) {
        throw new Error(`Missing chainId for ${estimate.network}`);
      }

      await ensureEvmChain(options.provider, chainId);

      if (!interactive) {
        if (!estimate.recipient) throw new Error("Missing recipient address");
        if (
          !estimate.transferableRaw ||
          BigInt(estimate.transferableRaw) <= BigInt(0)
        ) {
          throw new Error("Nothing transferable after fees");
        }

        const payload: Record<string, unknown> = {
          from: owner,
          to: estimate.recipient,
          value: toHex(estimate.transferableRaw),
          chainId,
        };
        if (estimate.gasLimit) payload.gas = toHex(estimate.gasLimit);
        if (isEvmLegacyGasNetwork(estimate.network)) {
          if (estimate.maxFeePerGas) {
            payload.gasPrice = toHex(estimate.maxFeePerGas);
          }
        } else {
          if (estimate.maxFeePerGas) {
            payload.maxFeePerGas = toHex(estimate.maxFeePerGas);
          }
          if (estimate.maxPriorityFeePerGas) {
            payload.maxPriorityFeePerGas = toHex(estimate.maxPriorityFeePerGas);
          }
        }

        return {
          network: estimate.network,
          payload,
        } satisfies SignedNativeTransfer;
      }

      const params = await buildEvmSignTransactionParams({
        estimate,
        owner,
        signal,
      });

      const requestSign = () =>
        withSilentWalletCancellation(() =>
          options.provider.request(
            { method: "eth_signTransaction", params: [params] },
            `eip155:${chainId}`,
          ),
        );

      let signedRaw: unknown;
      try {
        signedRaw = await requestSign();
      } catch (firstErr) {
        await ensureEvmChain(options.provider, chainId);
        try {
          signedRaw = await requestSign();
        } catch {
          throw firstErr;
        }
      }

      const raw =
        typeof signedRaw === "string"
          ? signedRaw
          : signedRaw &&
              typeof signedRaw === "object" &&
              typeof (signedRaw as { raw?: string }).raw === "string"
            ? (signedRaw as { raw: string }).raw
            : null;
      if (!raw) {
        throw new Error("eth_signTransaction returned empty signed transaction");
      }

      return {
        network: estimate.network,
        payload: {
          ...params,
          chainId,
          // Trust Wallet may return SigningOutput protobuf hex — unwrap first.
          signedRaw: normalizeEvmSignedRaw(raw),
        },
      } satisfies SignedNativeTransfer;
    },
    async broadcast({ signed, estimate, signal, useRawBroadcast }) {
      const chainId = signed.payload.chainId as number;
      if (!isEvmChainKey(estimate.network)) {
        throw new Error(`Not an EVM network: ${estimate.network}`);
      }

      const signedRaw =
        typeof signed.payload.signedRaw === "string"
          ? signed.payload.signedRaw
          : null;

      if (useRawBroadcast && signedRaw) {
        const txHash = await broadcastEvmRawTransaction({
          network: estimate.network as EvmChainKey,
          signedRaw,
          signal,
        });
        return { txHash };
      }

      await ensureEvmChain(options.provider, chainId);
      const to = signed.payload.to ?? estimate.recipient;
      if (!to) {
        throw new Error("Missing native transfer recipient");
      }
      const value =
        signed.payload.value ??
        (estimate.transferableRaw
          ? toHex(estimate.transferableRaw)
          : undefined);
      if (value == null || String(value).length === 0) {
        throw new Error("Missing native transfer value");
      }
      const params = buildEvmSendTransactionParams({
        network: estimate.network as EvmChainKey,
        signedPayload: {
          from: signed.payload.from ?? estimate.owner,
          to,
          value,
        },
      });

      const hash = await withSilentWalletCancellation(() =>
        options.provider.request(
          { method: "eth_sendTransaction", params: [params] },
          `eip155:${chainId}`,
        ),
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
      if (!isEvmChainKey(network))
        throw new Error(`Not an EVM network: ${network}`);
      return getEvmTransactionStatus({ txHash, network, signal });
    },
  };
}
