import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  validateMetaPixelId,
  validateWebsiteDomainInput,
  assertPlatformPlaceholdersEmpty,
} from "../config-engine/validators.mjs";
import {
  writeRuntimeState,
  readRuntimeState,
} from "../config-engine/runtime-state.mjs";
import {
  appendAuditRecord,
  readAuditHistory,
} from "../config-engine/audit.mjs";
import { runConfigUpdate } from "../config-engine/update-workflow.mjs";
import { withUpdateLock } from "../config-engine/lock.mjs";
import { getProductionConfig } from "../config-engine/index.mjs";
import { createConfigDeployAdapter } from "./fakes/config-deploy-adapter.mjs";
import { RUNTIME_STATE_SCHEMA_VERSION } from "../config-engine/constants.mjs";
import {
  migrateInit,
  readCompiledManagedValues,
} from "../config-engine/migrate-init.mjs";
import { verifyRetryPolicy } from "../core/verify.mjs";

function state(overrides = {}) {
  return {
    schemaVersion: RUNTIME_STATE_SCHEMA_VERSION,
    environment: "test",
    WEBSITE_DOMAIN: "example.com",
    META_PIXEL_ID: "123456789012345",
    lastChangeId: "CFG-20260819-000001",
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: "test@host",
    lastSource: "CLI",
    ...overrides,
  };
}

function withRuntimeDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "tmc-config-"));
  const prior = process.env.TMC_RUNTIME_CONFIG_DIR;
  process.env.TMC_RUNTIME_CONFIG_DIR = dir;
  try {
    return fn(dir);
  } finally {
    if (prior === undefined) delete process.env.TMC_RUNTIME_CONFIG_DIR;
    else process.env.TMC_RUNTIME_CONFIG_DIR = prior;
    rmSync(dir, { recursive: true, force: true });
  }
}

function workflowDeps(current, adapter) {
  return {
    readRuntimeState: () => current.value,
    writeRuntimeState: (_environment, next) => {
      current.value = next;
    },
    assertPlatformPlaceholdersEmpty: () => true,
    createContext: async (runtimeState, changedKey) => ({
      environment: "test",
      runtimeState,
      changedKey,
    }),
    preflight: async (ctx) => {
      ctx.compiled = {
        meta: { origins: { websiteDomain: ctx.runtimeState.WEBSITE_DOMAIN } },
      };
    },
    release: (ctx) => adapter.releaseConfigOnly(ctx),
    verify: (ctx) => adapter.verify(ctx),
    allocateChangeId: () => "CFG-20260819-000002",
  };
}

test("domain validator accepts a bare HTTPS origin", () =>
  assert.deepEqual(validateWebsiteDomainInput("https://Example.com"), {
    hostname: "example.com",
    walletOrigin: "https://example.com",
  }));

test("domain validator rejects HTTP, localhost, IP, paths, and wildcards", () => {
  for (const value of [
    "http://example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://example.com/path",
    "https://*.example.com",
  ])
    assert.throws(() => validateWebsiteDomainInput(value));
});

test("pixel validator rejects malformed values", () => {
  for (const value of ["", "pixel", "1234"])
    assert.throws(() => validateMetaPixelId(value));
});

test("valid pixel update succeeds and audits CLI source", async () => {
  await withRuntimeDir(async () => {
    const current = { value: state() };
    const adapter = createConfigDeployAdapter();
    const result = await runConfigUpdate({
      environment: "test",
      key: "META_PIXEL_ID",
      requestedValue: "123456789012346",
      actor: "tester@host",
      source: "CLI",
      deps: workflowDeps(current, adapter),
    });
    assert.equal(result.state.META_PIXEL_ID, "123456789012346");
    assert.equal(readAuditHistory("test")[0].source, "CLI");
    assert.deepEqual(adapter.calls[0].key, "META_PIXEL_ID");
  });
});

test("state and history use runtime config, not platform env", () => {
  withRuntimeDir(() => {
    writeRuntimeState("test", state());
    appendAuditRecord("test", {
      changeId: "CFG-20260819-000001",
      key: "WEBSITE_DOMAIN",
      actor: "test@host",
      source: "CLI",
      startedAt: new Date().toISOString(),
      phase: "complete",
      result: "SUCCESS",
    });
    assert.equal(readRuntimeState("test").WEBSITE_DOMAIN, "example.com");
    assert.equal(readAuditHistory("test")[0].source, "CLI");
  });
});

test("valid domain update applies state, emits ordered events, and audits CLI", async () => {
  await withRuntimeDir(async () => {
    const current = { value: state() };
    const adapter = createConfigDeployAdapter();
    const events = [];
    const result = await runConfigUpdate({
      environment: "test",
      key: "WEBSITE_DOMAIN",
      requestedValue: "https://new.example.com",
      actor: "tester@host",
      source: "CLI",
      onEvent: (event) => events.push(event),
      deps: workflowDeps(current, adapter),
    });
    assert.equal(result.state.WEBSITE_DOMAIN, "new.example.com");
    assert.deepEqual(
      events.map((event) => event.phase),
      [
        "read",
        "validation",
        "preflight",
        "apply",
        "restart",
        "verify",
        "complete",
      ],
    );
    assert.deepEqual(
      adapter.calls.map((call) => call.method),
      ["releaseConfigOnly", "verify"],
    );
    assert.equal(readAuditHistory("test")[0].source, "CLI");
  });
});

test("release or verification failure rolls back prior state and verifies it", async () => {
  await withRuntimeDir(async () => {
    const original = state();
    const current = { value: original };
    const adapter = createConfigDeployAdapter();
    let verifyCalls = 0;
    adapter.verify = async () => {
      adapter.calls.push({ method: "verify" });
      verifyCalls += 1;
      if (verifyCalls === 1) throw new Error("verify failure");
    };
    await assert.rejects(() =>
      runConfigUpdate({
        environment: "test",
        key: "META_PIXEL_ID",
        requestedValue: "123456789012346",
        actor: "tester@host",
        source: "CLI",
        deps: workflowDeps(current, adapter),
      }),
    );
    assert.equal(current.value.META_PIXEL_ID, original.META_PIXEL_ID);
    assert.equal(readAuditHistory("test")[0].result, "ROLLED_BACK");
    assert.equal(
      adapter.calls.filter((call) => call.method === "verify").length,
      2,
    );
  });
});

test("non-empty managed platform placeholders block updates", () => {
  const root = mkdtempSync(join(tmpdir(), "tmc-repo-"));
  mkdirSync(join(root, "config"));
  writeFileSync(
    join(root, "config/platform.env"),
    "WEBSITE_DOMAIN=live.example.com\nMETA_PIXEL_ID=\n",
  );
  try {
    assert.throws(
      () => assertPlatformPlaceholdersEmpty(root),
      /placeholders must be empty/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("concurrent updates are rejected while the lock is held", async () => {
  await withRuntimeDir(async () => {
    writeRuntimeState("test", state());
    let release;
    let acquired = false;
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    const first = withUpdateLock("test", async () => {
      acquired = true;
      await blocked;
    });
    while (!acquired) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await assert.rejects(
      () => withUpdateLock("test", async () => {}),
      /already in progress/,
    );
    release();
    await first;
  });
});

test("status reads runtime state instead of platform env", async () => {
  await withRuntimeDir(async () => {
    writeRuntimeState("production", state({ environment: "production" }));
    const config = await getProductionConfig("production");
    assert.equal(config.WEBSITE_DOMAIN, "example.com");
  });
});

test("migrate init can seed from compiled production wallet.env", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tmc-config-"));
  const prior = process.env.TMC_RUNTIME_CONFIG_DIR;
  process.env.TMC_RUNTIME_CONFIG_DIR = dir;
  try {
    const compiled = readCompiledManagedValues("production");
    assert.ok(compiled.domain);
    assert.match(compiled.pixel, /^\d{15,16}$/);
    const state = await migrateInit({
      environment: "test",
      domain: compiled.domain,
      pixel: compiled.pixel,
      actor: "tester@host",
    });
    assert.equal(state.WEBSITE_DOMAIN, compiled.domain);
    assert.equal(state.META_PIXEL_ID, compiled.pixel);
  } finally {
    if (prior === undefined) delete process.env.TMC_RUNTIME_CONFIG_DIR;
    else process.env.TMC_RUNTIME_CONFIG_DIR = prior;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli status reads runtime state", () => {
  withRuntimeDir(() => {
    writeRuntimeState("test", state());
    const result = spawnSync(
      process.execPath,
      [
        "deploy/config-engine/cli.mjs",
        "status",
        "--environment",
        "test",
        "--json",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TMC_RUNTIME_CONFIG_DIR: process.env.TMC_RUNTIME_CONFIG_DIR,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr.toString());
    const payload = JSON.parse(result.stdout.toString().trim());
    assert.equal(payload.state.WEBSITE_DOMAIN, "example.com");
  });
});

test("domain migration verify uses extended TLS/ACME retry window", () => {
  const defaultPolicy = verifyRetryPolicy({ changedKey: "META_PIXEL_ID" });
  assert.equal(defaultPolicy.retries, 15);
  assert.equal(defaultPolicy.delayMs, 2000);
  assert.equal(defaultPolicy.reason, null);

  const domainPolicy = verifyRetryPolicy({ changedKey: "WEBSITE_DOMAIN" });
  assert.equal(domainPolicy.retries, 90);
  assert.equal(domainPolicy.delayMs, 4000);
  assert.match(domainPolicy.reason, /domain migration/);
});
