import { TRON_CAIP } from "./constants";
import type { LinkedAccounts, UniversalProvider, WcSession } from "./types";

export function caipAccountAddress(caip: string) {
  const parts = caip.split(":");
  return parts[parts.length - 1] ?? "";
}

export function accountsFromSession(
  session: WcSession | undefined
): LinkedAccounts {
  return {
    evm: session?.namespaces?.eip155?.accounts?.[0]
      ? caipAccountAddress(session.namespaces.eip155.accounts[0])
      : null,
    tron: session?.namespaces?.tron?.accounts?.[0]
      ? caipAccountAddress(session.namespaces.tron.accounts[0])
      : null,
  };
}

/**
 * Universal Provider has no `tron` sub-provider.
 * Trust Wallet Confirm UI shows the full TriggerSmartContract tree only when
 * the WC payload matches the wallet's expected shape.
 */
export async function tronSignTransaction(
  provider: UniversalProvider,
  address: string,
  unsignedTx: Record<string, unknown>
): Promise<unknown> {
  const session = provider.session as WcSession | undefined;
  const tronNs = session?.namespaces?.tron;
  const tronAccounts = tronNs?.accounts ?? [];
  const hasWcTron = tronAccounts.length > 0;

  const txForWallet: Record<string, unknown> = {
    visible: unsignedTx.visible ?? false,
    ...unsignedTx,
  };

  if (hasWcTron && session?.topic && provider.client) {
    const sessionAddr =
      tronAccounts
        .map((a) => caipAccountAddress(a))
        .find((a) => a.toLowerCase() === address.toLowerCase()) ||
      caipAccountAddress(tronAccounts[0]) ||
      address;

    const usesV1 =
      session.sessionProperties?.tron_method_version === "v1";
    const txParam = usesV1 ? txForWallet : { transaction: txForWallet };

    return provider.client.request({
      topic: session.topic,
      chainId: TRON_CAIP,
      request: {
        method: "tron_signTransaction",
        params: {
          address: sessionAddr,
          transaction: txParam,
        },
      },
    });
  }

  if (typeof window !== "undefined") {
    const w = window as Window & {
      tronWeb?: {
        defaultAddress?: { base58?: string };
        trx?: {
          sign: (tx: Record<string, unknown>) => Promise<unknown>;
        };
      };
    };
    if (w.tronWeb?.trx?.sign) {
      return w.tronWeb.trx.sign(txForWallet);
    }
  }

  throw new Error(
    "Tron signing unavailable. Reconnect via WalletConnect and approve the Tron network, or open this page in Trust/TronLink."
  );
}

export async function getTronLinkAddress(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    tronLink?: { request: (args: { method: string }) => Promise<unknown> };
    tronWeb?: { defaultAddress?: { base58?: string } };
  };
  try {
    if (w.tronLink?.request) {
      await w.tronLink.request({ method: "tron_requestAccounts" });
    }
    const addr = w.tronWeb?.defaultAddress?.base58;
    return addr?.startsWith("T") ? addr : null;
  } catch {
    return null;
  }
}

/** Normalize wallet sign result into a broadcastable Tron tx. */
export function mergeTronSignedResult(
  unsignedTx: Record<string, unknown>,
  raw: unknown
): Record<string, unknown> {
  if (!raw || typeof raw !== "object") {
    throw new Error("Wallet returned an empty Tron sign result");
  }
  const signed = raw as Record<string, unknown>;
  const inner =
    signed.result && typeof signed.result === "object"
      ? (signed.result as Record<string, unknown>)
      : signed;

  const signature = inner.signature ?? signed.signature;
  const sigList = Array.isArray(signature)
    ? signature
    : typeof signature === "string" && signature
      ? [signature]
      : [];

  if (sigList.length === 0) {
    throw new Error(
      "Wallet signed but returned no signature — cannot broadcast"
    );
  }

  return {
    ...unsignedTx,
    ...inner,
    txID: inner.txID ?? unsignedTx.txID,
    raw_data: inner.raw_data ?? unsignedTx.raw_data,
    raw_data_hex: inner.raw_data_hex ?? unsignedTx.raw_data_hex,
    visible: inner.visible ?? unsignedTx.visible ?? true,
    signature: sigList,
  };
}
