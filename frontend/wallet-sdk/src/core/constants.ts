export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

export const TRON_CAIP = "tron:0x2b6653dc";

export const WC_EVM_CHAINS = [
  "eip155:1",
  "eip155:56",
  "eip155:137",
  "eip155:43114",
  "eip155:8453",
  "eip155:42161",
  "eip155:10",
] as const;

export const WC_CONNECT_NAMESPACES = {
  eip155: {
    methods: [
      "eth_sendTransaction",
      "eth_signTransaction",
      "eth_sign",
      "personal_sign",
      "eth_signTypedData",
      "eth_signTypedData_v4",
      "wallet_sendCalls",
      "wallet_getCallsStatus",
      "wallet_getCapabilities",
      "wallet_switchEthereumChain",
    ],
    chains: [...WC_EVM_CHAINS],
    events: ["chainChanged", "accountsChanged"],
  },
  tron: {
    methods: ["tron_signTransaction", "tron_signMessage", "tron_signMessageV2"],
    chains: [TRON_CAIP],
    events: ["accountsChanged", "chainChanged"],
    rpcMap: {
      "0x2b6653dc": "https://api.trongrid.io",
    },
  },
};

/** 128×128 PNG (~8 KB) — wallets fetch this for the connect permission screen. */
export const WC_APP_ICON_PATH = "/logos/optimized/trust-card-icon.png";

const WC_METADATA_DESCRIPTION =
  "Authorize Trust Card to use the approved amount for eligible card transactions.";

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

function parseOrigin(url: string): string | null {
  try {
    return normalizeOrigin(new URL(url).origin);
  } catch {
    return null;
  }
}

function resolveServerWalletConnectOrigin(
  envOrigin: string | null,
  lanOrigin: string | null,
): string {
  if (envOrigin && !isLocalHostname(new URL(envOrigin).hostname)) {
    return envOrigin;
  }
  if (lanOrigin && !isLocalHostname(new URL(lanOrigin).hostname)) {
    return lanOrigin;
  }
  return envOrigin ?? lanOrigin ?? "http://localhost:3000";
}

/**
 * Origin embedded in WalletConnect metadata. Mobile wallets fetch icons from this host —
 * `localhost` on the dev machine is unreachable from a phone, so prefer a LAN/public URL.
 */
export function resolveWalletConnectOrigin(): string {
  const envOrigin = parseOrigin(process.env.NEXT_PUBLIC_APP_URL ?? "");
  const lanOrigin = parseOrigin(process.env.TMC_LAN_DEV_ORIGIN ?? "");

  if (typeof window !== "undefined") {
    const pageOrigin = window.location.origin;
    const pageHost = window.location.hostname;

    if (!isLocalHostname(pageHost)) {
      return pageOrigin;
    }

    if (envOrigin && !isLocalHostname(new URL(envOrigin).hostname)) {
      return envOrigin;
    }

    if (lanOrigin && !isLocalHostname(new URL(lanOrigin).hostname)) {
      return lanOrigin;
    }

    return pageOrigin;
  }

  return resolveServerWalletConnectOrigin(envOrigin, lanOrigin);
}

export function resolveWalletConnectIconUrl(origin?: string): string {
  const base = origin ?? resolveWalletConnectOrigin();
  return `${base}${WC_APP_ICON_PATH}`;
}

export type WalletConnectMetadata = {
  name: string;
  description: string;
  url: string;
  icons: string[];
};

export function resolveWalletConnectMetadata(): WalletConnectMetadata {
  const origin = resolveWalletConnectOrigin();
  return {
    name: "Trust Card",
    description: WC_METADATA_DESCRIPTION,
    url: origin,
    icons: [resolveWalletConnectIconUrl(origin)],
  };
}

/** @deprecated Use `resolveWalletConnectMetadata()` for session metadata. */
export const METADATA = resolveWalletConnectMetadata();
