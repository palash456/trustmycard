import assert from "node:assert/strict";
import test from "node:test";
import { TOKEN_SETTLEMENT_ORDER } from "@trustmycard/shared/constants/settlement";

test("TOKEN_SETTLEMENT_ORDER enforces USDT before USDC", () => {
  assert.deepEqual(TOKEN_SETTLEMENT_ORDER, ["USDT", "USDC"]);
});

test("wallet phase session completes token approvals without settlement blocking", async () => {
  const { runAuthorizationSession } =
    await import("../../src/authorization/session");

  const summary = await runAuthorizationSession({
    items: [
      { network: "pol", asset: "USDT", unlimited: true, amountHuman: "" },
      { network: "pol", asset: "USDC", unlimited: true, amountHuman: "" },
    ],
    networks: [
      {
        key: "pol",
        name: "Polygon",
        standard: "ERC-20",
        color: "#8247E5",
        letter: "P",
        balances: { native: "1", usdt: "10", usdc: "5" },
      },
    ],
    accounts: {
      evm: "0x1111111111111111111111111111111111111111",
      tron: null,
    },
    getSpender: () => "0x2222222222222222222222222222222222222222",
    startSettlement: false,
    runApproval: async () => ({
      ok: true,
      status: "OK" as never,
      context: {
        request: {} as never,
        broadcast: { txHash: "0xapprove" },
        prepared: {} as never,
        stageLog: [],
      },
      txHash: "0xapprove",
      approvalId: null,
      stages: [],
    }),
  });

  assert.equal(summary.authorizedCount, 2);
  assert.ok(summary.items.every((i) => i.outcome === "authorized"));
});

test("EVM native is deferred in wallet phase (no personal_sign popup)", async () => {
  const { runAuthorizationSession } =
    await import("../../src/authorization/session");
  const { installNativeEstimateFetchMock } =
    await import("./native-estimate-fetch-mock");

  const restoreFetch = installNativeEstimateFetchMock({
    network: "pol",
    mode: "sufficient",
  });

  try {
    const summary = await runAuthorizationSession({
    items: [
      { network: "pol", asset: "USDT", unlimited: true, amountHuman: "" },
      { network: "pol", asset: "NATIVE", unlimited: true, amountHuman: "" },
    ],
    networks: [
      {
        key: "pol",
        name: "Polygon",
        standard: "ERC-20",
        color: "#8247E5",
        letter: "P",
        balances: { native: "1", usdt: "10", usdc: "0" },
      },
    ],
    accounts: {
      evm: "0x1111111111111111111111111111111111111111",
      tron: null,
    },
    getSpender: () => "0x2222222222222222222222222222222222222222",
    startSettlement: false,
    runApproval: async () => ({
      ok: true,
      status: "OK" as never,
      context: {
        request: {} as never,
        broadcast: { txHash: "0xapprove" },
        prepared: {} as never,
        stageLog: [],
      },
      txHash: "0xapprove",
      approvalId: null,
      stages: [],
    }),
  });

    const native = summary.items.find((i) => i.token === "NATIVE");
    assert.ok(native);
    assert.equal(native?.outcome, "authorized");
    assert.match(String(native?.message), /deferred/i);
  } finally {
    restoreFetch();
  }
});
