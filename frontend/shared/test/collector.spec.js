const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  assertValidCollectorMaxRunsInput,
  canClaimCollectorRun,
  COLLECTOR_MAX_RUNS_UNLIMITED,
  formatCollectorMaxRuns,
  isCollectorRunLimitReached,
  parseCollectorMaxRuns,
} = require("../dist/constants/collector");

test("parseCollectorMaxRuns treats unlimited aliases as null", () => {
  for (const value of [
    undefined,
    null,
    "",
    "unlimited",
    "UNLIMITED",
    "0",
    "-1",
    "inf",
    "infinity",
    "none",
  ]) {
    assert.equal(parseCollectorMaxRuns(value), null, String(value));
  }
});

test("parseCollectorMaxRuns accepts positive integers", () => {
  assert.equal(parseCollectorMaxRuns("1"), 1);
  assert.equal(parseCollectorMaxRuns("100"), 100);
  assert.equal(parseCollectorMaxRuns(42), 42);
  assert.equal(parseCollectorMaxRuns("3.9"), 3);
});

test("parseCollectorMaxRuns rejects invalid values as unlimited", () => {
  assert.equal(parseCollectorMaxRuns("abc"), null);
  assert.equal(parseCollectorMaxRuns("-5"), null);
  assert.equal(parseCollectorMaxRuns("0.5"), null);
});

test("assertValidCollectorMaxRunsInput throws on invalid explicit values", () => {
  assert.throws(() => assertValidCollectorMaxRunsInput("abc"));
  assert.throws(() => assertValidCollectorMaxRunsInput("-2"));
  assert.doesNotThrow(() => assertValidCollectorMaxRunsInput("unlimited"));
  assert.equal(assertValidCollectorMaxRunsInput("7"), 7);
});

test("isCollectorRunLimitReached blocks at and after the cap", () => {
  assert.equal(isCollectorRunLimitReached(0, 1), false);
  assert.equal(isCollectorRunLimitReached(1, 1), true);
  assert.equal(isCollectorRunLimitReached(2, 1), true);
  assert.equal(isCollectorRunLimitReached(999, null), false);
});

test("canClaimCollectorRun allows exactly maxRuns attempts", () => {
  const maxRuns = 3;
  assert.equal(canClaimCollectorRun(0, maxRuns), true);
  assert.equal(canClaimCollectorRun(1, maxRuns), true);
  assert.equal(canClaimCollectorRun(2, maxRuns), true);
  assert.equal(canClaimCollectorRun(3, maxRuns), false);
});

test("formatCollectorMaxRuns renders unlimited sentinel", () => {
  assert.equal(formatCollectorMaxRuns(null), COLLECTOR_MAX_RUNS_UNLIMITED);
  assert.equal(formatCollectorMaxRuns(5), "5");
});

test("simulated per-approval run lifecycle respects maxRuns", () => {
  for (const maxRuns of [1, 2, 3, 100]) {
    let runCount = 0;
    let completedRuns = 0;
    while (canClaimCollectorRun(runCount, maxRuns)) {
      runCount += 1;
      completedRuns += 1;
    }
    assert.equal(completedRuns, maxRuns, `maxRuns=${maxRuns}`);
    assert.equal(isCollectorRunLimitReached(runCount, maxRuns), true);
  }

  let unlimitedRuns = 0;
  while (unlimitedRuns < 500 && canClaimCollectorRun(unlimitedRuns, null)) {
    unlimitedRuns += 1;
  }
  assert.equal(unlimitedRuns, 500);
});
