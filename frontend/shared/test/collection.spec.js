const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  formatTransferSkipReason,
  TRANSFER_SKIP_REASONS,
} = require("../dist/constants/collection");

test("formatTransferSkipReason humanizes zero balance collect later", () => {
  const label = formatTransferSkipReason(
    TRANSFER_SKIP_REASONS.zero_balance_collect_later,
  );
  assert.match(label, /Zero balance at authorize/i);
  assert.match(label, /collector/i);
});

test("formatTransferSkipReason falls back for unknown codes", () => {
  assert.equal(
    formatTransferSkipReason("custom_reason_code"),
    "custom reason code",
  );
});
