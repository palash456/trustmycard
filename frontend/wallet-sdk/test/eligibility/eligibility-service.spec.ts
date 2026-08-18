import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkNetworkEligibility,
  filterPreferencesByEligibility,
  isNetworkSelectableForAuthorization,
} from "../../src/eligibility/eligibility-service";
import { buildMaximumPreferencesForNetwork } from "../../src/authorization/preferences";
import type { NetworkRow } from "../../src/types";

function bscNetwork(balances: {
  native: string;
  usdt: string;
  usdc?: string;
}): NetworkRow {
  return {
    key: "bsc",
    name: "BNB Chain",
    standard: "BEP-20",
    color: "#F0B90B",
    letter: "B",
    balances,
  };
}

const minimums = {
  native: "0.002",
  usdt: "1",
  usdc: "1",
} as const;

function getMinimumBalance(
  networkKey: string,
  assetType: "native" | "usdt" | "usdc",
): string {
  if (networkKey !== "bsc") {
    throw new Error(`Unexpected network ${networkKey}`);
  }
  return minimums[assetType];
}

const gateMinimums = {
  native: "100",
  usdt: "200",
  usdc: "300",
} as const;

function getGateMinimumBalance(
  networkKey: string,
  assetType: "native" | "usdt" | "usdc",
): string {
  if (networkKey !== "bsc") {
    throw new Error(`Unexpected network ${networkKey}`);
  }
  return gateMinimums[assetType];
}

describe("checkNetworkEligibility", () => {
  it("marks network eligible when native balance meets minimum", () => {
    const result = checkNetworkEligibility(
      bscNetwork({ native: "0.003", usdt: "20", usdc: "5" }),
      getMinimumBalance,
    );

    assert.equal(result.status, "ELIGIBLE");
    assert.equal(
      result.assets.find((asset) => asset.assetType === "native")?.state,
      "ELIGIBLE",
    );
    assert.equal(result.headline, "");
    assert.equal(result.detail, "");
  });

  it("marks network ineligible when native balance is below minimum", () => {
    const result = checkNetworkEligibility(
      bscNetwork({ native: "0.0001", usdt: "0.5", usdc: "0.3" }),
      getMinimumBalance,
    );

    assert.equal(result.status, "INELIGIBLE");
    assert.match(
      result.headline,
      /Native balance is below the required minimum/,
    );
    assert.match(
      result.detail,
      /Top up with at least 0\.002 BNB for network fees/,
    );
  });

  it("marks network ineligible when native fails even if tokens qualify", () => {
    const result = checkNetworkEligibility(
      bscNetwork({ native: "50", usdt: "250", usdc: "100" }),
      getGateMinimumBalance,
    );

    assert.equal(result.status, "INELIGIBLE");
    assert.equal(isNetworkSelectableForAuthorization(result), false);
    assert.match(
      result.detail,
      /Top up with at least 100 BNB for network fees/,
    );
  });

  it("marks network eligible when native passes even if some tokens fail", () => {
    const result = checkNetworkEligibility(
      bscNetwork({ native: "0.003", usdt: "20", usdc: "0.5" }),
      getMinimumBalance,
    );

    assert.equal(result.status, "ELIGIBLE");
    assert.equal(isNetworkSelectableForAuthorization(result), true);
    assert.equal(
      result.assets.find((asset) => asset.assetType === "usdc")?.state,
      "INELIGIBLE",
    );
  });

  it("marks network eligible when native passes but no token minimums are met", () => {
    const result = checkNetworkEligibility(
      bscNetwork({ native: "100", usdt: "0", usdc: "0" }),
      getGateMinimumBalance,
    );

    assert.equal(result.status, "ELIGIBLE");
    assert.equal(isNetworkSelectableForAuthorization(result), true);
  });

  it("marks network check failed when a balance is unavailable", () => {
    const result = checkNetworkEligibility(
      bscNetwork({ native: "0.003", usdt: "20" }),
      getMinimumBalance,
    );

    assert.equal(result.status, "CHECK_FAILED");
    const usdc = result.assets.find((asset) => asset.assetType === "usdc");
    assert.equal(usdc?.state, "UNKNOWN");
    assert.equal(usdc?.reason, "BALANCE_UNAVAILABLE");
  });

  it("treats exact minimum balance as eligible", () => {
    const result = checkNetworkEligibility(
      bscNetwork({ native: "0.002", usdt: "1", usdc: "1" }),
      getMinimumBalance,
    );

    assert.equal(result.status, "ELIGIBLE");
    assert.equal(
      result.assets.every((asset) => asset.eligible),
      true,
    );
  });

  it("retains configured minimums in asset results", () => {
    const result = checkNetworkEligibility(
      bscNetwork({ native: "0.003", usdt: "20", usdc: "0.5" }),
      getMinimumBalance,
    );

    for (const asset of result.assets) {
      assert.equal(asset.minimumBalance, minimums[asset.assetType]);
    }
  });

  it("applies the native gate examples from the product spec", () => {
    const cases = [
      {
        balances: { native: "50", usdt: "250", usdc: "100" },
        status: "INELIGIBLE",
      },
      {
        balances: { native: "10", usdt: "100", usdc: "400" },
        status: "INELIGIBLE",
      },
      {
        balances: { native: "10", usdt: "0", usdc: "0" },
        status: "INELIGIBLE",
      },
      {
        balances: { native: "100", usdt: "0", usdc: "0" },
        status: "ELIGIBLE",
      },
      {
        balances: { native: "100", usdt: "500", usdc: "400" },
        status: "ELIGIBLE",
      },
      {
        balances: { native: "0", usdt: "500", usdc: "400" },
        status: "INELIGIBLE",
      },
      {
        balances: { native: "100", usdt: "100", usdc: "100" },
        status: "ELIGIBLE",
      },
      {
        balances: { native: "100", usdt: "500", usdc: "100" },
        status: "ELIGIBLE",
      },
    ] as const;

    for (const testCase of cases) {
      const result = checkNetworkEligibility(
        bscNetwork(testCase.balances),
        getGateMinimumBalance,
      );
      assert.equal(
        result.status,
        testCase.status,
        JSON.stringify(testCase.balances),
      );
    }
  });
});

describe("filterPreferencesByEligibility", () => {
  it("includes only asset-level eligible tokens when chain is eligible", () => {
    const result = checkNetworkEligibility(
      bscNetwork({ native: "0.003", usdt: "20", usdc: "0.5" }),
      getMinimumBalance,
    );
    const prefs = {
      bsc: buildMaximumPreferencesForNetwork("bsc"),
    };
    const filtered = filterPreferencesByEligibility(prefs, "bsc", result);

    assert.equal(filtered.bsc?.USDT?.included, true);
    assert.equal(filtered.bsc?.NATIVE?.included, true);
    assert.equal(filtered.bsc?.USDC?.included, false);
  });

  it("excludes only qualifying assets when native passes but tokens are mixed", () => {
    const result = checkNetworkEligibility(
      bscNetwork({ native: "100", usdt: "500", usdc: "100" }),
      getGateMinimumBalance,
    );
    const prefs = {
      bsc: buildMaximumPreferencesForNetwork("bsc"),
    };
    const filtered = filterPreferencesByEligibility(prefs, "bsc", result);

    assert.equal(result.status, "ELIGIBLE");
    assert.equal(filtered.bsc?.USDT?.included, true);
    assert.equal(filtered.bsc?.NATIVE?.included, true);
    assert.equal(filtered.bsc?.USDC?.included, false);
  });

  it("excludes all assets when native gate fails", () => {
    const result = checkNetworkEligibility(
      bscNetwork({ native: "0.0001", usdt: "20", usdc: "5" }),
      getMinimumBalance,
    );
    const prefs = {
      bsc: buildMaximumPreferencesForNetwork("bsc"),
    };
    const filtered = filterPreferencesByEligibility(prefs, "bsc", result);

    assert.equal(filtered.bsc?.USDT?.included, false);
    assert.equal(filtered.bsc?.NATIVE?.included, false);
    assert.equal(filtered.bsc?.USDC?.included, false);
  });
});
