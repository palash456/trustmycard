import assert from "node:assert/strict";
import test from "node:test";
import {
  errorForLog,
  getErrorMessage,
} from "../src/common/utils/error-message";

test("getErrorMessage formats nested API errors for logs", () => {
  assert.equal(
    getErrorMessage({ message: "Provide address", statusCode: 400 }),
    "Provide address",
  );
  assert.equal(errorForLog({ message: "Provide address" }), "Provide address");
  assert.equal(errorForLog({ statusCode: 400 }), '{"statusCode":400}');
});
