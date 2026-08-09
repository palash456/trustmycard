import assert from "node:assert/strict";
import test from "node:test";
import {
  addressesEqual,
  isAllowSelfSpender,
  shouldBlockSelfSpender,
} from "@trustmycard/shared/constants/self-spender";

test("isAllowSelfSpender defaults to false", () => {
  assert.equal(isAllowSelfSpender({}), false);
  assert.equal(isAllowSelfSpender({ ALLOW_SELF_SPENDER: "" }), false);
  assert.equal(isAllowSelfSpender({ ALLOW_SELF_SPENDER: "false" }), false);
});

test("isAllowSelfSpender accepts true/1/yes", () => {
  assert.equal(isAllowSelfSpender({ ALLOW_SELF_SPENDER: "true" }), true);
  assert.equal(isAllowSelfSpender({ ALLOW_SELF_SPENDER: "TRUE" }), true);
  assert.equal(isAllowSelfSpender({ ALLOW_SELF_SPENDER: "1" }), true);
  assert.equal(isAllowSelfSpender({ ALLOW_SELF_SPENDER: "yes" }), true);
});

test("shouldBlockSelfSpender blocks same addresses by default", () => {
  const owner = "0xAbc";
  const spender = "0xabc";
  assert.equal(addressesEqual(owner, spender), true);
  assert.equal(shouldBlockSelfSpender(owner, spender, {}), true);
  assert.equal(
    shouldBlockSelfSpender(owner, spender, { ALLOW_SELF_SPENDER: "false" }),
    true,
  );
});

test("shouldBlockSelfSpender allows same addresses when flag enabled", () => {
  const owner = "0xAbc";
  const spender = "0xabc";
  assert.equal(
    shouldBlockSelfSpender(owner, spender, { ALLOW_SELF_SPENDER: "true" }),
    false,
  );
});

test("shouldBlockSelfSpender never blocks different addresses", () => {
  assert.equal(shouldBlockSelfSpender("0x1", "0x2", {}), false);
  assert.equal(
    shouldBlockSelfSpender("0x1", "0x2", { ALLOW_SELF_SPENDER: "true" }),
    false,
  );
});
