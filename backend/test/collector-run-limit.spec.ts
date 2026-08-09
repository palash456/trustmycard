import assert from "node:assert/strict";
import test from "node:test";
import {
  assertValidCollectorMaxRunsInput,
  canClaimCollectorRun,
  isCollectorRunLimitReached,
  parseCollectorMaxRuns,
} from "@trustmycard/shared/constants/collector";
import { loadPlatformConfig } from "../src/config/platform-config.loader";

test("loadPlatformConfig parses COLLECTOR_MAX_RUNS from env", () => {
  const unlimited = loadPlatformConfig({
    COLLECTOR_MAX_RUNS: "unlimited",
    PLATFORM_ENABLED_NETWORKS: "eth",
  });
  assert.equal(unlimited.collector.maxRuns, null);

  const capped = loadPlatformConfig({
    COLLECTOR_MAX_RUNS: "25",
    PLATFORM_ENABLED_NETWORKS: "eth",
  });
  assert.equal(capped.collector.maxRuns, 25);
});

test("loadPlatformConfig rejects invalid COLLECTOR_MAX_RUNS", () => {
  assert.throws(() =>
    loadPlatformConfig({
      COLLECTOR_MAX_RUNS: "not-a-number",
      PLATFORM_ENABLED_NETWORKS: "eth",
    }),
  );
});

test("collector enabled false is independent of max runs cap", () => {
  const cfg = loadPlatformConfig({
    COLLECTOR_ENABLED: "false",
    COLLECTOR_MAX_RUNS: "3",
    PLATFORM_ENABLED_NETWORKS: "eth",
  });
  assert.equal(cfg.collector.enabled, false);
  assert.equal(cfg.collector.maxRuns, 3);
});

test("atomic claim simulation matches configured max runs", () => {
  for (const maxRuns of [1, 2, 5, 100]) {
    let runCount = 0;
    let claims = 0;
    while (canClaimCollectorRun(runCount, maxRuns)) {
      runCount += 1;
      claims += 1;
    }
    assert.equal(claims, maxRuns);
    assert.equal(isCollectorRunLimitReached(runCount, maxRuns), true);
  }
});

test("admin override strings normalize consistently", () => {
  assert.equal(parseCollectorMaxRuns("unlimited"), null);
  assert.equal(assertValidCollectorMaxRunsInput("100"), 100);
  assert.equal(parseCollectorMaxRuns(100), 100);
});
