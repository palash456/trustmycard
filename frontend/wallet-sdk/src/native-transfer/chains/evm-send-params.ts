import {
  NATIVE_CHAIN_REGISTRY,
  type EvmChainKey,
} from "../../core/native-chains";

/**
 * Build eth_sendTransaction params from a signed native transfer payload.
 *
 * BSC / Trust Wallet: never send `data: "0x"`. Trust Wallet's Smart Chain path
 * can treat that empty hex as an already-signed raw tx and broadcast
 * eth_sendRawTransaction("0x"), which PublicNode rejects with:
 *   "reading transaction object failed - rawTx: 0x, error: error unmarshalling"
 * Also omit pre-filled gas — let the wallet estimate (same shape as working
 * ERC-20 approvals: from/to/value only).
 *
 * Other EVM chains: keep `data: "0x"` for Trust Wallet WalletConnect validation,
 * plus EIP-1559 fee fields when present.
 */
export function buildEvmSendTransactionParams(args: {
  network: EvmChainKey;
  signedPayload: Record<string, unknown>;
}): Record<string, string> {
  const params: Record<string, string> = {
    from: String(args.signedPayload.from),
    to: String(args.signedPayload.to),
    value: String(args.signedPayload.value),
  };

  const legacyGas = NATIVE_CHAIN_REGISTRY[args.network]?.legacyGas === true;
  if (legacyGas) {
    return params;
  }

  // Trust Wallet WC validation for native sends on EIP-1559 chains.
  params.data = "0x";

  const gas = args.signedPayload.gas;
  if (gas != null && String(gas).length > 0) {
    params.gas = String(gas);
  }

  const maxFee = args.signedPayload.maxFeePerGas;
  const maxPriority = args.signedPayload.maxPriorityFeePerGas;
  if (maxFee != null && String(maxFee).length > 0) {
    params.maxFeePerGas = String(maxFee);
  }
  if (maxPriority != null && String(maxPriority).length > 0) {
    params.maxPriorityFeePerGas = String(maxPriority);
  }

  return params;
}
