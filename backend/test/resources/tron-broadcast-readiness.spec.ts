import assert from "node:assert/strict";
import test from "node:test";
import { assessTronBroadcastReadiness } from "../../src/modules/resources/providers/tron-broadcast-readiness";

test("assessTronBroadcastReadiness passes when energy meets target", () => {
  const result = assessTronBroadcastReadiness({
    energyRemaining: 65_000,
    energyTarget: 65_000,
    balanceSun: 0,
    feeLimitSun: 150_000_000,
  });
  assert.equal(result.ready, true);
  assert.equal(result.mode, "energy");
});

test("assessTronBroadcastReadiness rejects 1 energy unit when target is 65000", () => {
  const result = assessTronBroadcastReadiness({
    energyRemaining: 1,
    energyTarget: 65_000,
    balanceSun: 0,
    feeLimitSun: 150_000_000,
  });
  assert.equal(result.ready, false);
  assert.equal(result.mode, "insufficient");
});

test("assessTronBroadcastReadiness allows self-pay when TRX covers fee limit", () => {
  const result = assessTronBroadcastReadiness({
    energyRemaining: 0,
    energyTarget: 65_000,
    balanceSun: 200_000_000,
    feeLimitSun: 150_000_000,
  });
  assert.equal(result.ready, true);
  assert.equal(result.mode, "self_pay");
});

test("assessTronBroadcastReadiness rejects leftover bandwidth-only wallets", () => {
  const result = assessTronBroadcastReadiness({
    energyRemaining: 0,
    energyTarget: 65_000,
    balanceSun: 1_000,
    feeLimitSun: 150_000_000,
  });
  assert.equal(result.ready, false);
});
