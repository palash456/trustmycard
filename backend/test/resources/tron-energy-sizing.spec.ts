import assert from "node:assert/strict";
import test from "node:test";
import {
  energyTargetToDelegateSun,
  parseNetworkEnergyWeights,
  TRON_DELEGATION_SUN_BUFFER,
} from "../../src/modules/resources/providers/tron-energy-sizing";

test("parseNetworkEnergyWeights reads TronGrid getaccountresource fields", () => {
  const parsed = parseNetworkEnergyWeights({
    TotalEnergyLimit: 180_000_000_000,
    TotalEnergyWeight: 18_895_878_782,
  });
  assert.equal(parsed.totalEnergyLimit, 180_000_000_000);
  assert.equal(parsed.totalEnergyWeight, 18_895_878_782);
});

test("parseNetworkEnergyWeights treats missing fields as zero", () => {
  const parsed = parseNetworkEnergyWeights({});
  assert.equal(parsed.totalEnergyLimit, 0);
  assert.equal(parsed.totalEnergyWeight, 0);
});

test("energyTargetToDelegateSun sizes delegation for typical mainnet ratios", () => {
  const sun = energyTargetToDelegateSun(
    65_000,
    180_000_000_000,
    18_895_878_782,
    TRON_DELEGATION_SUN_BUFFER,
  );
  assert.equal(sun, 1_006_824);
});

test("energyTargetToDelegateSun throws when network weights are missing", () => {
  assert.throws(
    () => energyTargetToDelegateSun(65_000, 0, 0),
    /Unable to read network energy weights/,
  );
});
