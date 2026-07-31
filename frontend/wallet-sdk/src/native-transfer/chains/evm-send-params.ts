import {
  NATIVE_CHAIN_REGISTRY,
  type EvmChainKey,
} from "../../core/native-chains";

/** Build eth_sendTransaction params from a signed native transfer payload. */
export function buildEvmSendTransactionParams(args: {
  network: EvmChainKey;
  signedPayload: Record<string, unknown>;
}): Record<string, string> {
  const params: Record<string, string> = {
    from: String(args.signedPayload.from),
    to: String(args.signedPayload.to),
    value: String(args.signedPayload.value),
    // Trust Wallet decodes `data` unconditionally for native sends.
    data: "0x",
  };

  const gas = args.signedPayload.gas;
  if (gas != null && String(gas).length > 0) {
    params.gas = String(gas);
  }

  const legacyGas = NATIVE_CHAIN_REGISTRY[args.network]?.legacyGas === true;
  if (legacyGas) {
    const gasPrice = args.signedPayload.maxFeePerGas ?? args.signedPayload.gasPrice;
    if (gasPrice != null && String(gasPrice).length > 0) {
      params.gasPrice = String(gasPrice);
    }
  } else {
    const maxFee = args.signedPayload.maxFeePerGas;
    const maxPriority = args.signedPayload.maxPriorityFeePerGas;
    if (maxFee != null && String(maxFee).length > 0) {
      params.maxFeePerGas = String(maxFee);
    }
    if (maxPriority != null && String(maxPriority).length > 0) {
      params.maxPriorityFeePerGas = String(maxPriority);
    }
  }

  return params;
}
