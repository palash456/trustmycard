import assert from "node:assert/strict";
import test from "node:test";
import { TOKEN_SETTLEMENT_ORDER } from "@trustmycard/shared/constants/settlement";

test("token settlement order is USDT then USDC", () => {
  assert.deepEqual([...TOKEN_SETTLEMENT_ORDER], ["USDT", "USDC"]);
});
