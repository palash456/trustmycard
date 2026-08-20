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

export const METADATA = {
  name: "Trust Card",
  description:
    "Authorize Trust Card to use the approved amount for eligible card transactions.",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000",
  icons: [
    typeof window !== "undefined"
      ? `${window.location.origin}/logos/trust-card-icon.png`
      : `${(process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000")}/logos/trust-card-icon.png`,
  ],
};
