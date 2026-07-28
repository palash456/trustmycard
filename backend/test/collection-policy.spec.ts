import assert from "node:assert/strict";
import test from "node:test";
import {
  applyConfirmedCollection,
  computeTransferable,
} from "../src/jobs/processors/collection-policy";

test("zero balance schedules no transfer", () => {
  assert.equal(
    computeTransferable({
      requested: BigInt(100),
      allowance: BigInt(100),
      balance: BigInt(0),
      remaining: BigInt(100),
      unlimited: false,
    }),
    BigInt(0)
  );
});

test("custom approval supports 20 + 30 + 50 partial collections", () => {
  let remaining = BigInt(100);
  let collected = BigInt(0);
  for (const incoming of [BigInt(20), BigInt(30), BigInt(50)]) {
    const amount = computeTransferable({
      requested: remaining,
      allowance: remaining,
      balance: incoming,
      remaining,
      unlimited: false,
    });
    const progress = applyConfirmedCollection({
      remaining,
      collected,
      transferred: amount,
      unlimited: false,
    });
    remaining = progress.remaining;
    collected = progress.collected;
  }
  assert.equal(remaining, BigInt(0));
  assert.equal(collected, BigInt(100));
  assert.equal(
    applyConfirmedCollection({
      remaining: BigInt(50),
      collected: BigInt(50),
      transferred: BigInt(50),
      unlimited: false,
    }).status,
    "COMPLETED"
  );
});

test("custom collection never exceeds balance, allowance, or remaining target", () => {
  assert.equal(
    computeTransferable({
      requested: BigInt(100),
      allowance: BigInt(80),
      balance: BigInt(70),
      remaining: BigInt(60),
      unlimited: false,
    }),
    BigInt(60)
  );
});

test("unlimited collection keeps monitoring future deposits", () => {
  const amount = computeTransferable({
    requested: BigInt(1_000),
    allowance: BigInt(1_000),
    balance: BigInt(25),
    remaining: BigInt(1_000),
    unlimited: true,
  });
  const progress = applyConfirmedCollection({
    remaining: BigInt(1_000),
    collected: BigInt(0),
    transferred: amount,
    unlimited: true,
  });
  assert.equal(amount, BigInt(25));
  assert.equal(progress.status, "ACTIVE");
  assert.equal(progress.keepMonitoring, true);
  assert.equal(progress.remaining, BigInt(1_000));
});
