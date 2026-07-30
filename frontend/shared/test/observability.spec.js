const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const {
  errorForLog,
  getErrorMessage,
  serializeError,
  getErrorCode,
} = require("../dist/observability/errors");
const { LogSampler, buildSamplingKey } = require("../dist/observability/sampling");
const { MetricRegistry, formatPrometheusText } = require("../dist/observability/metrics");
const { SessionTimelineTracker } = require("../dist/observability/timeline");
const { withTiming, TIMING_METRICS } = require("../dist/observability/timing");
const {
  createRootEventContext,
  createChildEventContext,
} = require("../dist/observability/event-context");
const { redactContext } = require("../dist/observability/redaction");

describe("observability errors", () => {
  it("getErrorMessage formats nested API errors", () => {
    assert.equal(
      getErrorMessage({ message: "Provide address", statusCode: 400 }),
      "Provide address"
    );
    assert.equal(errorForLog({ message: "Provide address" }), "Provide address");
    assert.equal(errorForLog({ statusCode: 400 }), '{"statusCode":400}');
  });

  it("avoids [object Object] from Error constructed with object", () => {
    const wrapped = new Error(String({ message: "Native transfer blocked" }));
    assert.equal(wrapped.message, "[object Object]");
    assert.equal(
      getErrorMessage({ message: "Native transfer blocked" }),
      "Native transfer blocked"
    );
  });

  it("serializeError captures nested shapes", () => {
    const s = serializeError({ message: "fail", code: "X", statusCode: 400 });
    assert.equal(s.message, "fail");
    assert.equal(s.code, "X");
    assert.equal(s.status, 400);
  });

  it("getErrorCode extracts code", () => {
    assert.equal(getErrorCode({ code: "ESTIMATE_FAILED" }), "ESTIMATE_FAILED");
  });
});

describe("log sampler", () => {
  it("emits first N then every Nth for info", () => {
    const sampler = new LogSampler({ enabled: true });
    const key = { operation: "rpc", stage: "call", status: "rpc_failure" };
    let emitted = 0;
    for (let i = 0; i < 15; i++) {
      const d = sampler.shouldEmit("info", "rpc", key);
      if (d.emit) emitted++;
    }
    assert.equal(emitted, 10);
  });

  it("never samples error level", () => {
    const sampler = new LogSampler({ enabled: true });
    const key = { operation: "test" };
    for (let i = 0; i < 50; i++) {
      const d = sampler.shouldEmit("error", "wallet", key);
      assert.equal(d.emit, true);
    }
  });

  it("includes sampling info on periodic emit", () => {
    const sampler = new LogSampler({
      enabled: true,
      defaultPolicy: {
        trace: { firstN: 1, thenEveryNth: 5 },
        debug: { firstN: 1, thenEveryNth: 5 },
        info: { firstN: 1, thenEveryNth: 5 },
        warn: { firstN: 1, thenEveryNth: 5 },
        error: { firstN: 999, thenEveryNth: 1 },
        fatal: { firstN: 999, thenEveryNth: 1 },
      },
      moduleOverrides: {},
      neverSampleLevels: ["error", "fatal"],
    });
    const key = { op: "x" };
    for (let i = 0; i < 5; i++) sampler.shouldEmit("info", "m", key);
    const d = sampler.shouldEmit("info", "m", key);
    assert.equal(d.emit, true);
    if (d.emit && d.info) {
      assert.equal(d.info.totalOccurrences, 6);
      assert.ok(d.info.suppressedCount >= 4);
    }
  });

  it("buildSamplingKey is stable", () => {
    assert.equal(
      buildSamplingKey({ a: 1, b: 2 }),
      buildSamplingKey({ b: 2, a: 1 })
    );
  });
});

describe("metrics registry", () => {
  it("increments counters without logging", () => {
    const reg = new MetricRegistry();
    reg.increment("collector.transfers.completed", { network: "eth" });
    reg.increment("collector.transfers.completed", { network: "eth" });
    const snap = reg.snapshot();
    assert.equal(snap.counters.length, 1);
    assert.equal(snap.counters[0].value, 2);
  });

  it("observes histogram timings", () => {
    const reg = new MetricRegistry();
    reg.observe("approval.duration_ms", 100, { token: "USDT" });
    reg.observe("approval.duration_ms", 200, { token: "USDT" });
    const snap = reg.snapshot();
    assert.equal(snap.histograms[0].count, 2);
    assert.equal(snap.histograms[0].avg, 150);
  });

  it("formats prometheus text", () => {
    const reg = new MetricRegistry();
    reg.increment("test_total", { status: "ok" });
    const text = formatPrometheusText(reg.snapshot());
    assert.match(text, /test_total/);
  });
});

describe("session timeline", () => {
  it("builds hierarchical journey", () => {
    const tracker = new SessionTimelineTracker({
      sessionId: "sess-1",
      walletAddress: "0xabc",
    });
    tracker.startRoot("AUTHORIZATION_STARTED");
    const parent = createRootEventContext({ sessionId: "sess-1" });
    const child = createChildEventContext(parent);
    tracker.pushFromContext(child, "WALLET_CONNECTED", "success", {
      durationMs: 100,
    });
    const snap = tracker.complete("partial_success");
    assert.equal(snap.events.length, 2);
    assert.equal(snap.outcome, "partial_success");
    assert.ok(snap.totalDurationMs >= 0);
  });
});

describe("withTiming", () => {
  it("records duration metric", () => {
    return withTiming(TIMING_METRICS.balanceScan, { network: "eth" }, async () => {
      return 42;
    }).then(({ result, durationMs }) => {
      assert.equal(result, 42);
      assert.ok(durationMs >= 0);
    });
  });
});

describe("redaction", () => {
  it("redacts sensitive keys", () => {
    const out = redactContext({
      walletAddress: "0x1",
      privateKey: "secret",
      nested: { apiKey: "k" },
    });
    assert.equal(out.walletAddress, "0x1");
    assert.equal(out.privateKey, "[REDACTED]");
    assert.deepEqual(out.nested, { apiKey: "[REDACTED]" });
  });
});

describe("fail-open", () => {
  const { safeObservability } = require("../dist/observability/fail-open");
  const { incrementCounter, recordTiming } = require("../dist/observability/metrics");

  it("safeObservability swallows sync errors", () => {
    let ran = false;
    safeObservability(() => {
      throw new Error("observability failed");
    });
    safeObservability(() => {
      ran = true;
    });
    assert.equal(ran, true);
  });

  it("incrementCounter and recordTiming never throw", () => {
    assert.doesNotThrow(() =>
      incrementCounter("test.metric", { module: "x" })
    );
    assert.doesNotThrow(() =>
      recordTiming("test.timing_ms", 12, { status: "success" })
    );
  });
});
