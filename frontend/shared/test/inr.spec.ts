import assert from "node:assert/strict";
import test from "node:test";
import {
  convertCollectedToInr,
  FALLBACK_INR_RATES,
} from "../fx/inr.js";

test("convertCollectedToInr sums each token amount at its own INR rate", () => {
  const total = convertCollectedToInr(
    [
      {
        network: "arb",
        tokenSymbol: "USDT",
        collectedHuman: "1.90",
      },
      {
        network: "arb",
        tokenSymbol: "ETH",
        collectedHuman: "0.5",
      },
    ],
    FALLBACK_INR_RATES,
  );

  assert.equal(
    total,
    1.9 * FALLBACK_INR_RATES.USDT + 0.5 * FALLBACK_INR_RATES.ETH,
  );
});

test("convertCollectedToInr ignores zero or unknown tokens", () => {
  const total = convertCollectedToInr(
    [
      {
        network: "pol",
        tokenSymbol: "USDT",
        collectedHuman: "2",
      },
      {
        network: "pol",
        tokenSymbol: "UNKNOWN",
        collectedHuman: "100",
      },
    ],
    FALLBACK_INR_RATES,
  );

  assert.equal(total, 2 * FALLBACK_INR_RATES.USDT);
});
