import assert from "node:assert/strict";
import test from "node:test";
import { encodeMulticall3Aggregate3 } from "../../src/core/evm-multicall3";

test("encodeMulticall3Aggregate3 uses aggregate3 selector", () => {
  const data = encodeMulticall3Aggregate3([
    {
      target: "0x1111111111111111111111111111111111111111",
      allowFailure: false,
      callData:
        "0x095ea7b3000000000000000000000000000000000000000000000000000000000000000001",
    },
    {
      target: "0x2222222222222222222222222222222222222222",
      allowFailure: false,
      callData:
        "0x095ea7b3000000000000000000000000000000000000000000000000000000000000000002",
    },
  ]);
  assert.ok(data.startsWith("0x82ad56cb"));
});
