import assert from "node:assert/strict";
import test from "node:test";
import { errorForLog, getErrorMessage } from "../../src/core/errors";

test("getErrorMessage extracts nested NestJS error objects", () => {
  assert.equal(
    getErrorMessage({ message: "Insufficient balance after estimated network fees" }),
    "Insufficient balance after estimated network fees"
  );
  assert.equal(
    getErrorMessage({ message: ["owner is required", "network is required"] }),
    "owner is required; network is required"
  );
  assert.equal(
    getErrorMessage({ error: { message: "Bad Request" } }),
    "Bad Request"
  );
});

test("getErrorMessage avoids [object Object] from Error constructed with object", () => {
  const wrapped = new Error({ message: "Native transfer blocked" } as unknown as string);
  assert.equal(wrapped.message, "[object Object]");
  assert.equal(
    getErrorMessage({ message: "Native transfer blocked" }),
    "Native transfer blocked"
  );
});

test("getErrorMessage serializes unknown object shapes", () => {
  assert.equal(
    getErrorMessage({ code: "ESTIMATE_FAILED", detail: "no gas" }),
    '{"code":"ESTIMATE_FAILED","detail":"no gas"}'
  );
});

test("errorForLog returns null for empty values", () => {
  assert.equal(errorForLog(null), null);
  assert.equal(errorForLog(""), null);
  assert.equal(errorForLog(undefined), null);
  assert.equal(
    errorForLog({ message: "transfer failed" }),
    "transfer failed"
  );
});
