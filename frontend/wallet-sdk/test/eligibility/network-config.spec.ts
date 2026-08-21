import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { rowsFromBalances } from "../../src/core/network-meta";
import type { BalancesResponse } from "../../src/types";
import {
  buildNetworkConfigForTests,
  getAllowedNetworks,
  getNetworkMinimumBalance,
  isNetworkAllowed,
  resetNetworkConfigCacheForTests,
} from "../../src/eligibility/network-config";

const ORIGINAL_ENV = { ...process.env };

function setAllowEnv(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
  resetNetworkConfigCacheForTests();
}

function balancesForAllNetworks(): BalancesResponse {
  const zero = { native: "1", usdt: "1", usdc: "1" };
  return {
    eth: zero,
    bsc: zero,
    pol: zero,
    avax: zero,
    arb: zero,
    base: zero,
    op: zero,
    tron: zero,
  };
}

describe("network-config", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetNetworkConfigCacheForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetNetworkConfigCacheForTests();
  });

  it("filters network rows to allowed networks only", () => {
    setAllowEnv({
      NEXT_PUBLIC_ALLOW_ETH: "false",
      NEXT_PUBLIC_ALLOW_BSC: "true",
      NEXT_PUBLIC_ALLOW_POLYGON: "false",
      NEXT_PUBLIC_ALLOW_AVAX: "true",
      NEXT_PUBLIC_ALLOW_ARB: "false",
      NEXT_PUBLIC_ALLOW_BASE: "false",
      NEXT_PUBLIC_ALLOW_OP: "false",
      NEXT_PUBLIC_ALLOW_TRON: "true",
    });

    const rows = rowsFromBalances(balancesForAllNetworks()).filter((row) =>
      isNetworkAllowed(row.key),
    );

    assert.deepEqual(
      rows.map((row) => row.key).sort(),
      ["avax", "bsc", "tron"],
    );
    assert.ok(!rows.some((row) => row.key === "eth"));
  });

  it("returns empty allowed list when every network is disabled", () => {
    setAllowEnv({
      NEXT_PUBLIC_ALLOW_ETH: "false",
      NEXT_PUBLIC_ALLOW_BSC: "false",
      NEXT_PUBLIC_ALLOW_POLYGON: "false",
      NEXT_PUBLIC_ALLOW_AVAX: "false",
      NEXT_PUBLIC_ALLOW_ARB: "false",
      NEXT_PUBLIC_ALLOW_BASE: "false",
      NEXT_PUBLIC_ALLOW_OP: "false",
      NEXT_PUBLIC_ALLOW_TRON: "false",
    });

    assert.deepEqual(getAllowedNetworks(), []);
  });

  it("returns all networks when all allow flags are true", () => {
    setAllowEnv({
      NEXT_PUBLIC_ALLOW_ETH: "true",
      NEXT_PUBLIC_ALLOW_BSC: "true",
      NEXT_PUBLIC_ALLOW_POLYGON: "true",
      NEXT_PUBLIC_ALLOW_AVAX: "true",
      NEXT_PUBLIC_ALLOW_ARB: "true",
      NEXT_PUBLIC_ALLOW_BASE: "true",
      NEXT_PUBLIC_ALLOW_OP: "true",
      NEXT_PUBLIC_ALLOW_TRON: "true",
    });

    assert.deepEqual(getAllowedNetworks(), [
      "eth",
      "bsc",
      "pol",
      "avax",
      "arb",
      "base",
      "op",
      "tron",
    ]);
  });

  it("supports only one enabled network", () => {
    setAllowEnv({
      NEXT_PUBLIC_ALLOW_BSC: "true",
    });

    assert.deepEqual(getAllowedNetworks(), ["bsc"]);
  });

  it("removes OP from allowed networks when disabled", () => {
    setAllowEnv({
      NEXT_PUBLIC_ALLOW_OP: "false",
      NEXT_PUBLIC_ALLOW_ETH: "true",
    });

    assert.equal(isNetworkAllowed("op"), false);
    assert.deepEqual(getAllowedNetworks(), ["eth"]);
  });

  it("resolves minimum balances through getNetworkMinimumBalance", () => {
    setAllowEnv({
      NEXT_PUBLIC_ETH_MIN_NATIVE_BALANCE: "0.02",
      NEXT_PUBLIC_ETH_MIN_USDT_BALANCE: "",
    });

    assert.equal(getNetworkMinimumBalance("eth", "native"), "0.02");
    assert.equal(getNetworkMinimumBalance("eth", "usdt"), "0");
    assert.equal(getNetworkMinimumBalance("missing", "native"), "0");
  });

  it("buildNetworkConfigForTests exposes normalized config entries", () => {
    const config = buildNetworkConfigForTests({
      NEXT_PUBLIC_ALLOW_OP: "true",
      NEXT_PUBLIC_OP_MIN_NATIVE_BALANCE: "0.005",
    });

    assert.equal(config.op.allowed, true);
    assert.equal(config.op.minNativeBalance, "0.005");
  });
});
