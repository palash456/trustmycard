const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  generateFlowId,
  walletSuffix,
  journeyCoreFromFlowId,
  isSemanticFlowId,
  isLegacyFlowId,
  generatePublicId,
  formatIstDateTimeParts,
} = require("../dist/ids/index.js");

describe("flow-id", () => {
  it("walletSuffix uses last 6 alphanumeric chars", () => {
    assert.equal(
      walletSuffix("0x742d35Cc6634C0532925a8b8C4a8F92C"),
      "A8F92C"
    );
    assert.equal(walletSuffix("TXYZabc123def456"), "DEF456");
  });

  it("generateFlowId uses IST date/time segments", () => {
    const istDate = new Date("2026-08-09T08:53:15.000Z");
    const id = generateFlowId({
      walletAddress: "0x742d35Cc6634C0532925a8b8C4a8F92C",
      now: istDate,
    });
    assert.equal(id, "flow-20260809-142315-A8F92C");
    assert.equal(isSemanticFlowId(id), true);
  });

  it("supports collision suffix", () => {
    const id = generateFlowId({
      walletAddress: "0xabc",
      now: new Date("2026-08-09T08:53:15.000Z"),
      collisionSuffix: "X7",
    });
    assert.match(id, /-X7$/);
    assert.equal(journeyCoreFromFlowId(id), "20260809-142315-000ABC-X7");
  });

  it("detects legacy flow ids", () => {
    assert.equal(isLegacyFlowId("flow-m5x2k9a-k3f8p2"), true);
    assert.equal(isLegacyFlowId("flow-20260809-142315-A8F92C"), false);
  });

  it("generatePublicId embeds journey core", () => {
    const journey = "flow-20260809-142315-A8F92C";
    assert.equal(
      generatePublicId("approval", "usdt", journey),
      "approval-usdt-20260809-142315-A8F92C"
    );
    assert.equal(
      generatePublicId("transfer", "usdc", journey, 2),
      "transfer-usdc-20260809-142315-A8F92C-02"
    );
  });

  it("IST midnight boundary keeps same calendar date", () => {
    const beforeMidnightIst = new Date("2026-08-09T18:29:59.000Z");
    const parts = formatIstDateTimeParts(beforeMidnightIst);
    assert.equal(parts.ymd, "20260809");
    assert.equal(parts.hms, "235959");
  });
});
