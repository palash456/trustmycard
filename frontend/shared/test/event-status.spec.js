const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const {
  formatObservabilityModulePath,
  resolveConnectStepLogStatus,
  resolveObservabilityDisplayStatus,
} = require("../dist/observability/event-status");
const {
  formatObservabilityMessage,
} = require("../dist/observability/messages");

describe("observability event status", () => {
  it("marks connect milestones as success instead of in_progress", () => {
    assert.equal(resolveConnectStepLogStatus("SCAN STARTED"), "success");
    assert.equal(resolveConnectStepLogStatus("CONNECT STARTED"), "success");
    assert.equal(resolveConnectStepLogStatus("WALLET CONNECTED"), "success");
    assert.equal(
      resolveConnectStepLogStatus("STEP 1 COMPLETE — WALLET CONNECTED + BALANCES"),
      "success",
    );
  });

  it("keeps settlement progress dynamic", () => {
    assert.equal(
      resolveConnectStepLogStatus("SETTLEMENT PROGRESS", { stage: "completed" }),
      "success",
    );
    assert.equal(
      resolveConnectStepLogStatus("SETTLEMENT PROGRESS", { stage: "failed" }),
      "failure",
    );
    assert.equal(
      resolveConnectStepLogStatus("SETTLEMENT PROGRESS", {
        stage: "collecting_token",
      }),
      "in_progress",
    );
  });

  it("maps stored in_progress rows to completed display status for milestones", () => {
    assert.equal(
      resolveObservabilityDisplayStatus({
        status: "in_progress",
        module: "connect",
        operation: "scan_started",
        stage: "SCAN STARTED",
      }),
      "completed",
    );
    assert.equal(
      resolveObservabilityDisplayStatus({
        status: "in_progress",
        module: "connect",
        operation: "wallet_connected",
        stage: "WALLET CONNECTED",
      }),
      "completed",
    );
  });

  it("maps cancellation and failure display statuses", () => {
    assert.equal(
      resolveObservabilityDisplayStatus({
        status: "user_rejection",
        stage: "TRANSACTION_CANCELLED",
      }),
      "cancelled",
    );
    assert.equal(
      resolveObservabilityDisplayStatus({
        status: "failure",
        stage: "BALANCES FETCH FAILED",
      }),
      "failed",
    );
  });

  it("formats module path without stage text", () => {
    assert.equal(
      formatObservabilityModulePath("connect", "scan_started"),
      "connect/scan_started",
    );
  });
});

describe("observability messages", () => {
  it("uses stage headline when message is generic", () => {
    assert.equal(
      formatObservabilityMessage({
        module: "connect",
        operation: "scan_started",
        stage: "SCAN STARTED",
        message: "SCAN STARTED",
      }),
      "SCAN STARTED",
    );
  });

  it("formats settlement progress with context", () => {
    assert.match(
      formatObservabilityMessage({
        module: "connect",
        operation: "settlement_progress",
        stage: "SETTLEMENT PROGRESS",
        message: "Settlement in progress",
        context: {
          stage: "executing_native",
          network: "eth",
        },
      }),
      /native transfer on ETH/i,
    );
  });
});
