import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNetworkConfigFromEnv,
  getAllowedNetworkKeys,
  getNetworkMinimumBalanceFromConfig,
  isNetworkAllowedKey,
  parseAllowBoolean,
  parseMinimumBalance,
} from "../constants/network-env-parsers";

describe("network-env-parsers", () => {
  describe("parseAllowBoolean", () => {
    it("enables only explicit true", () => {
      assert.equal(parseAllowBoolean("true"), true);
      assert.equal(parseAllowBoolean("TRUE"), true);
      assert.equal(parseAllowBoolean(" True "), true);
    });

    it("disables false, missing, empty, and invalid values", () => {
      assert.equal(parseAllowBoolean("false"), false);
      assert.equal(parseAllowBoolean(undefined), false);
      assert.equal(parseAllowBoolean(null), false);
      assert.equal(parseAllowBoolean(""), false);
      assert.equal(parseAllowBoolean("yes"), false);
      assert.equal(parseAllowBoolean("1"), false);
    });
  });

  describe("parseMinimumBalance", () => {
    it("accepts valid non-negative numbers", () => {
      assert.equal(parseMinimumBalance("0"), "0");
      assert.equal(parseMinimumBalance("0.01"), "0.01");
      assert.equal(parseMinimumBalance("12.5"), "12.5");
    });

    it("defaults missing, empty, invalid, and negative to 0", () => {
      assert.equal(parseMinimumBalance(undefined), "0");
      assert.equal(parseMinimumBalance(null), "0");
      assert.equal(parseMinimumBalance(""), "0");
      assert.equal(parseMinimumBalance("not-a-number"), "0");
      assert.equal(parseMinimumBalance("-1"), "0");
      assert.equal(parseMinimumBalance("-0.01"), "0");
    });
  });

  describe("network allowlist from env", () => {
    it("returns only explicitly allowed networks", () => {
      const config = buildNetworkConfigFromEnv({
        NEXT_PUBLIC_ALLOW_ETH: "false",
        NEXT_PUBLIC_ALLOW_BSC: "true",
        NEXT_PUBLIC_ALLOW_POLYGON: "false",
        NEXT_PUBLIC_ALLOW_AVAX: "true",
        NEXT_PUBLIC_ALLOW_ARB: "false",
        NEXT_PUBLIC_ALLOW_BASE: "false",
        NEXT_PUBLIC_ALLOW_OP: "false",
        NEXT_PUBLIC_ALLOW_TRON: "true",
      });

      assert.deepEqual(getAllowedNetworkKeys(config), ["bsc", "avax", "tron"]);
      assert.equal(isNetworkAllowedKey("eth", config), false);
      assert.equal(isNetworkAllowedKey("bsc", config), true);
    });

    it("treats all networks as disabled when allow flags are missing", () => {
      const config = buildNetworkConfigFromEnv({});
      assert.deepEqual(getAllowedNetworkKeys(config), []);
      assert.equal(isNetworkAllowedKey("eth", config), false);
    });

    it("includes OP when enabled", () => {
      const config = buildNetworkConfigFromEnv({
        NEXT_PUBLIC_ALLOW_OP: "true",
      });
      assert.equal(isNetworkAllowedKey("op", config), true);
      assert.deepEqual(getAllowedNetworkKeys(config), ["op"]);
    });

    it("resolves minimum balances with safe defaults", () => {
      const config = buildNetworkConfigFromEnv({
        NEXT_PUBLIC_ETH_MIN_NATIVE_BALANCE: "0.01",
        NEXT_PUBLIC_ETH_MIN_USDT_BALANCE: "bad",
        NEXT_PUBLIC_ETH_MIN_USDC_BALANCE: "-5",
      });

      assert.equal(
        getNetworkMinimumBalanceFromConfig("eth", "native", config),
        "0.01",
      );
      assert.equal(
        getNetworkMinimumBalanceFromConfig("eth", "usdt", config),
        "0",
      );
      assert.equal(
        getNetworkMinimumBalanceFromConfig("eth", "usdc", config),
        "0",
      );
      assert.equal(
        getNetworkMinimumBalanceFromConfig("unknown", "native", config),
        "0",
      );
    });
  });
});
