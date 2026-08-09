import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureEvmChain,
  hasEvmWalletSession,
  NoEvmSessionError,
} from "../../src/native-transfer/ensure-evm-chain";
import type { UniversalProvider } from "../../src/types";

function mockProvider(args: {
  chainId?: string;
  accounts?: { eip155?: string[]; tron?: string[] };
  onRequest?: (method: string, chain?: string) => unknown;
}): UniversalProvider {
  let chainId = args.chainId ?? "0x38";
  const requests: Array<{ method: string; chain?: string }> = [];

  return {
    session: {
      namespaces: {
        ...(args.accounts?.eip155?.length
          ? { eip155: { accounts: args.accounts.eip155 } }
          : {}),
        ...(args.accounts?.tron?.length
          ? { tron: { accounts: args.accounts.tron } }
          : {}),
      },
    },
    request: async (
      req: { method: string; params?: unknown[] },
      chain?: string,
    ) => {
      requests.push({ method: req.method, chain });
      if (args.onRequest) return args.onRequest(req.method, chain);
      if (req.method === "eth_chainId") return chainId;
      if (req.method === "wallet_switchEthereumChain") {
        const next = (req.params?.[0] as { chainId?: string } | undefined)
          ?.chainId;
        if (next) chainId = next;
        return null;
      }
      throw new Error(`unexpected ${req.method}`);
    },
  } as unknown as UniversalProvider;
}

test("hasEvmWalletSession detects eip155 namespace", () => {
  assert.equal(
    hasEvmWalletSession(
      mockProvider({ accounts: { eip155: ["eip155:56:0xabc"] } }),
    ),
    true,
  );
  assert.equal(
    hasEvmWalletSession(
      mockProvider({ accounts: { tron: ["tron:0x2b6653dc:TXyz"] } }),
    ),
    false,
  );
});

test("ensureEvmChain rejects Tron-only sessions", async () => {
  const provider = mockProvider({
    accounts: { tron: ["tron:0x2b6653dc:TXyz"] },
  });
  await assert.rejects(
    () => ensureEvmChain(provider, 56),
    (err: unknown) => err instanceof NoEvmSessionError,
  );
});

test("ensureEvmChain scopes eth_chainId to eip155 chain namespace", async () => {
  const calls: string[] = [];
  const provider = mockProvider({
    chainId: "0x38",
    accounts: { eip155: ["eip155:56:0xabc"] },
    onRequest(method, chain) {
      calls.push(`${method}:${chain ?? "none"}`);
      if (method === "eth_chainId") return "0x38";
      return null;
    },
  });

  await ensureEvmChain(provider, 56);
  assert.ok(
    calls.every((c) => c.endsWith(":eip155:56")),
    `expected eip155:56 namespace, got ${calls.join(", ")}`,
  );
});

test("ensureEvmChain adds chain when switch fails with unrecognized chain", async () => {
  let addCalled = false;
  let chainId = "0x1";
  const provider = mockProvider({
    chainId,
    accounts: { eip155: ["eip155:42161:0xabc"] },
    onRequest(method) {
      if (method === "eth_chainId") return chainId;
      if (method === "wallet_switchEthereumChain") {
        if (chainId === "0xa4b1") return null;
        const err = new Error("Unrecognized chain ID");
        (err as Error & { code: number }).code = 4902;
        throw err;
      }
      if (method === "wallet_addEthereumChain") {
        addCalled = true;
        chainId = "0xa4b1";
        return null;
      }
      return null;
    },
  });

  await ensureEvmChain(provider, 42161);
  assert.equal(addCalled, true);
});

test("ensureEvmChain no-ops when already on expected chain", async () => {
  let switchCalls = 0;
  const provider = mockProvider({
    chainId: "0x38",
    accounts: { eip155: ["eip155:56:0xabc"] },
    onRequest(method) {
      if (method === "wallet_switchEthereumChain") switchCalls += 1;
      if (method === "eth_chainId") return "0x38";
      return null;
    },
  });

  await ensureEvmChain(provider, 56);
  assert.equal(switchCalls, 0);
});
