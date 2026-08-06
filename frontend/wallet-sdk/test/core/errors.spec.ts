import assert from "node:assert/strict";
import test from "node:test";
import {
  errorForLog,
  getErrorMessage,
  shouldSuppressWalletConsoleErrorForTest,
} from "../../src/core/errors";

test("shouldSuppressWalletConsoleErrorForTest mutes empty WalletConnect payloads", () => {
  assert.equal(shouldSuppressWalletConsoleErrorForTest([]), true);
  assert.equal(shouldSuppressWalletConsoleErrorForTest([{}]), true);
  assert.equal(shouldSuppressWalletConsoleErrorForTest([{ message: "" }]), true);
  assert.equal(
    shouldSuppressWalletConsoleErrorForTest(["User rejected the request"]),
    true
  );
});

test("shouldSuppressWalletConsoleErrorForTest keeps real errors", () => {
  assert.equal(
    shouldSuppressWalletConsoleErrorForTest(["Prepare failed: network timeout"]),
    false
  );
  assert.equal(
    shouldSuppressWalletConsoleErrorForTest([
      { message: "Insufficient balance after network fees" },
    ]),
    false
  );
  assert.equal(
    shouldSuppressWalletConsoleErrorForTest([new Error("broadcast failed")]),
    false
  );
  assert.equal(shouldSuppressWalletConsoleErrorForTest([{ code: "X" }]), false);
});

test("shouldSuppressWalletConsoleErrorForTest mutes known WalletConnect noise", () => {
  assert.equal(
    shouldSuppressWalletConsoleErrorForTest([
      "Missing or invalid. request() method: wallet_getCapabilities",
    ]),
    true
  );
  assert.equal(
    shouldSuppressWalletConsoleErrorForTest([
      "request() -> isValidRequest() failed",
    ]),
    true
  );
  assert.equal(
    shouldSuppressWalletConsoleErrorForTest([
      {
        msg: "No internet connection detected. Please restart your network and try again.",
      },
    ]),
    true
  );
  const explorerError = new TypeError("Failed to fetch");
  explorerError.stack = "TypeError: Failed to fetch\n    at fetchListings";
  assert.equal(shouldSuppressWalletConsoleErrorForTest([explorerError]), true);
});

test("shouldSuppressWalletConsoleErrorForTest keeps unrelated fetch errors", () => {
  assert.equal(
    shouldSuppressWalletConsoleErrorForTest([new TypeError("Failed to fetch")]),
    false
  );
});

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

test("isUserRejection detects EIP-1193 rejection codes", async () => {
  const { isUserRejection } = await import("@trustmycard/shared/observability");
  assert.equal(isUserRejection({ code: 4001 }), true);
  assert.equal(isUserRejection({ code: "4001", message: "" }), true);
  assert.equal(isUserRejection(new Error("User rejected the request")), true);
  assert.equal(isUserRejection(new Error("broadcast failed")), false);
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
