import assert from "node:assert/strict";
import test from "node:test";
import {
  isWalletPersonalSignAllowed,
  resolveWalletPersonalSignEnabled,
  setWalletPersonalSignPolicy,
} from "../../src/authorization/wallet-personal-sign-policy";
import { fetchWalletSessionToken } from "../../src/authorization/wallet-session-token";

test("resolveWalletPersonalSignEnabled honors explicit false from platform config", () => {
  assert.equal(
    resolveWalletPersonalSignEnabled({
      wallets: { spenderEvm: "", spenderTron: "" },
      approval: {} as never,
      collection: {} as never,
      native: {} as never,
      client: {} as never,
      transfer: {} as never,
      chains: {} as never,
      featureFlags: {
        collectorEnabled: true,
        collectorMaxRuns: null,
        nativeReconcileEnabled: true,
        resourceSponsorEnabled: true,
        walletPersonalSignEnabled: false,
      },
    }),
    false,
  );
});

test("fetchWalletSessionToken rejects when personal_sign policy is disabled", async () => {
  setWalletPersonalSignPolicy(false);
  try {
    await assert.rejects(
      () =>
        fetchWalletSessionToken({
          provider: { request: async () => "0x" } as never,
          apiBaseUrl: "",
          owner: "0x1111111111111111111111111111111111111111",
          network: "avax",
          walletPersonalSignEnabled: false,
        }),
      /personal_sign authentication is disabled/i,
    );
  } finally {
    setWalletPersonalSignPolicy(true);
  }
});

test("isWalletPersonalSignAllowed uses runtime policy when explicit arg omitted", () => {
  setWalletPersonalSignPolicy(false);
  try {
    assert.equal(isWalletPersonalSignAllowed(), false);
    assert.equal(isWalletPersonalSignAllowed(true), true);
  } finally {
    setWalletPersonalSignPolicy(true);
  }
});
