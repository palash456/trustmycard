import assert from "node:assert/strict";
import test from "node:test";
import {
  NETWORK_FETCH_HELPER_INITIAL,
  NETWORK_FETCH_HELPER_LONG_WAIT,
  NETWORK_FETCH_LONG_WAIT_MS,
  NETWORK_FETCH_ROTATING_MESSAGES,
  networkFetchHelperMessage,
  networkFetchInitialMessage,
  networkFetchRotatingMessage,
} from "../../src/core/network-fetch-loading-messages";

test("networkFetchInitialMessage includes card name", () => {
  assert.match(networkFetchInitialMessage("silver"), /Silver/);
  assert.match(
    networkFetchInitialMessage("metal"),
    /fetching your network, blockchain, and token information/
  );
});

test("networkFetchRotatingMessage loops through all messages", () => {
  assert.equal(networkFetchRotatingMessage(0), NETWORK_FETCH_ROTATING_MESSAGES[0]);
  assert.equal(
    networkFetchRotatingMessage(NETWORK_FETCH_ROTATING_MESSAGES.length),
    NETWORK_FETCH_ROTATING_MESSAGES[0]
  );
});

test("networkFetchHelperMessage switches after 60 seconds", () => {
  assert.equal(networkFetchHelperMessage(0), NETWORK_FETCH_HELPER_INITIAL);
  assert.equal(
    networkFetchHelperMessage(NETWORK_FETCH_LONG_WAIT_MS - 1),
    NETWORK_FETCH_HELPER_INITIAL
  );
  assert.equal(
    networkFetchHelperMessage(NETWORK_FETCH_LONG_WAIT_MS),
    NETWORK_FETCH_HELPER_LONG_WAIT
  );
});
