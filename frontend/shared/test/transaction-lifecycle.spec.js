const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const {
  TRANSACTION_TERMINAL_STAGES,
  isTransactionTerminalStage,
  terminalStatusFromStage,
} = require("../dist/constants/transaction-lifecycle");

describe("transaction lifecycle constants", () => {
  it("recognizes terminal stages", () => {
    assert.equal(isTransactionTerminalStage(TRANSACTION_TERMINAL_STAGES.FAILED), true);
    assert.equal(isTransactionTerminalStage("WALLET_CONNECTED"), false);
  });

  it("maps terminal stages to status", () => {
    assert.equal(
      terminalStatusFromStage(TRANSACTION_TERMINAL_STAGES.EXPIRED),
      "EXPIRED"
    );
    assert.equal(terminalStatusFromStage("PREPARE"), null);
  });
});
