import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  getMinimumBalance,
  getMinimumBalanceEnvVarName,
} from "../../src/eligibility/eligibility-config";
import { resetNetworkConfigCacheForTests } from "../../src/eligibility/network-config";

const ORIGINAL_ENV = { ...process.env };

function setAllNetworksEnabled() {
  for (const key of [
    "ETH",
    "BSC",
    "POLYGON",
    "AVAX",
    "ARB",
    "BASE",
    "OP",
    "TRON",
  ]) {
    process.env[`NEXT_PUBLIC_ALLOW_${key}`] = "true";
  }
}

describe("eligibility-config", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetNetworkConfigCacheForTests();
    setAllNetworksEnabled();
    process.env.NEXT_PUBLIC_BSC_MIN_NATIVE_BALANCE = "0.002";
    process.env.NEXT_PUBLIC_BSC_MIN_USDT_BALANCE = "1";
    process.env.NEXT_PUBLIC_BSC_MIN_USDC_BALANCE = "1";
    process.env.NEXT_PUBLIC_ETH_MIN_NATIVE_BALANCE = "0.001";
    process.env.NEXT_PUBLIC_ETH_MIN_USDT_BALANCE = "1";
    process.env.NEXT_PUBLIC_ETH_MIN_USDC_BALANCE = "1";
    process.env.NEXT_PUBLIC_POLYGON_MIN_NATIVE_BALANCE = "0.01";
    process.env.NEXT_PUBLIC_POLYGON_MIN_USDT_BALANCE = "1";
    process.env.NEXT_PUBLIC_POLYGON_MIN_USDC_BALANCE = "1";
    process.env.NEXT_PUBLIC_AVAX_MIN_NATIVE_BALANCE = "0.01";
    process.env.NEXT_PUBLIC_AVAX_MIN_USDT_BALANCE = "1";
    process.env.NEXT_PUBLIC_AVAX_MIN_USDC_BALANCE = "1";
    process.env.NEXT_PUBLIC_ARB_MIN_NATIVE_BALANCE = "0.001";
    process.env.NEXT_PUBLIC_ARB_MIN_USDT_BALANCE = "1";
    process.env.NEXT_PUBLIC_ARB_MIN_USDC_BALANCE = "1";
    process.env.NEXT_PUBLIC_BASE_MIN_NATIVE_BALANCE = "0.001";
    process.env.NEXT_PUBLIC_BASE_MIN_USDT_BALANCE = "1";
    process.env.NEXT_PUBLIC_BASE_MIN_USDC_BALANCE = "1";
    process.env.NEXT_PUBLIC_OP_MIN_NATIVE_BALANCE = "0.005";
    process.env.NEXT_PUBLIC_OP_MIN_USDT_BALANCE = "1";
    process.env.NEXT_PUBLIC_OP_MIN_USDC_BALANCE = "1";
    process.env.NEXT_PUBLIC_TRON_MIN_NATIVE_BALANCE = "5";
    process.env.NEXT_PUBLIC_TRON_MIN_USDT_BALANCE = "1";
    process.env.NEXT_PUBLIC_TRON_MIN_USDC_BALANCE = "1";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetNetworkConfigCacheForTests();
  });

  it("returns configured minimum for known network and asset", () => {
    assert.equal(getMinimumBalance("bsc", "native"), "0.002");
    assert.equal(getMinimumBalance("tron", "usdt"), "1");
    assert.equal(getMinimumBalance("op", "native"), "0.005");
  });

  it("returns 0 for unknown network keys", () => {
    assert.equal(getMinimumBalance("unknown", "native"), "0");
  });

  it("defaults missing balance env vars to 0", () => {
    delete process.env.NEXT_PUBLIC_BSC_MIN_USDT_BALANCE;
    resetNetworkConfigCacheForTests();
    assert.equal(getMinimumBalance("bsc", "usdt"), "0");
  });

  it("defaults invalid balance env vars to 0", () => {
    process.env.NEXT_PUBLIC_BSC_MIN_USDT_BALANCE = "not-a-number";
    resetNetworkConfigCacheForTests();
    assert.equal(getMinimumBalance("bsc", "usdt"), "0");
  });

  it("resolves all supported networks without cross-chain contamination", () => {
    const networks = [
      "eth",
      "bsc",
      "pol",
      "avax",
      "arb",
      "base",
      "op",
      "tron",
    ] as const;
    const assets = ["native", "usdt", "usdc"] as const;

    for (const network of networks) {
      for (const asset of assets) {
        const value = getMinimumBalance(network, asset);
        assert.match(value, /^\d+(\.\d+)?$/);
        assert.match(
          getMinimumBalanceEnvVarName(network, asset),
          /^NEXT_PUBLIC_/,
        );
      }
    }
  });
});
