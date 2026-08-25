import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEDULER_IDLE_INTERVAL_MS_DEFAULT,
  SCHEDULER_IDLE_INTERVAL_MS_MIN,
  computeSchedulerSleepMs,
  resolveSchedulerIdleIntervalMs,
} from "../src/jobs/schedulers/background-work-probe";

test("resolveSchedulerIdleIntervalMs defaults to six minutes", () => {
  assert.equal(
    resolveSchedulerIdleIntervalMs({}),
    SCHEDULER_IDLE_INTERVAL_MS_DEFAULT,
  );
});

test("resolveSchedulerIdleIntervalMs enforces Neon autosuspend minimum", () => {
  assert.equal(
    resolveSchedulerIdleIntervalMs({ SCHEDULER_IDLE_INTERVAL_MS: "120000" }),
    SCHEDULER_IDLE_INTERVAL_MS_MIN,
  );
});

test("computeSchedulerSleepMs uses active interval when work exists", () => {
  assert.equal(
    computeSchedulerSleepMs({
      idle: false,
      activeIntervalMs: 60_000,
      idleIntervalMs: 360_000,
      nextCollectionDueAt: null,
    }),
    60_000,
  );
});

test("computeSchedulerSleepMs backs off to idle interval when idle", () => {
  assert.equal(
    computeSchedulerSleepMs({
      idle: true,
      activeIntervalMs: 60_000,
      idleIntervalMs: 360_000,
      nextCollectionDueAt: null,
    }),
    360_000,
  );
});

test("computeSchedulerSleepMs wakes before scheduled collection work", () => {
  const now = Date.now();
  const dueIn = 4 * 60_000;
  assert.equal(
    computeSchedulerSleepMs({
      idle: true,
      activeIntervalMs: 60_000,
      idleIntervalMs: 360_000,
      nextCollectionDueAt: new Date(now + dueIn),
      now,
    }),
    dueIn + 1_000,
  );
});
