import assert from "node:assert/strict";
import test from "node:test";
import {
  tronResourceAdvisory,
  tronResourceBlockReason,
} from "../../src/server/approvals/tron-resources";

test("tronResourceAdvisory warns on 0 TRX and 0 Energy but does not imply hard block", () => {
  const advisory = tronResourceAdvisory({
    exists: true,
    balanceSun: BigInt(0),
    balanceTrx: "0",
    freeNetRemaining: 600,
    energyRemaining: 0,
  });
  assert.ok(advisory);
  assert.match(advisory!, /resource sponsorship/i);
});

test("tronResourceAdvisory is null when TRX or Energy available", () => {
  assert.equal(
    tronResourceAdvisory({
      exists: true,
      balanceSun: BigInt(1_000_000),
      balanceTrx: "1",
      freeNetRemaining: 600,
      energyRemaining: 0,
    }),
    null
  );
  assert.equal(
    tronResourceAdvisory({
      exists: true,
      balanceSun: BigInt(0),
      balanceTrx: "0",
      freeNetRemaining: 600,
      energyRemaining: 50_000,
    }),
    null
  );
});

test("tronResourceBlockReason is alias of advisory (no separate hard block)", () => {
  const resources = {
    exists: false,
    balanceSun: BigInt(0),
    balanceTrx: "0",
    freeNetRemaining: 0,
    energyRemaining: 0,
  };
  assert.equal(tronResourceBlockReason(resources), tronResourceAdvisory(resources));
});
