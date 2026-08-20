#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  resolveProductionApiOrigin,
  resolveProductionBackendUrl,
  resolveWebsiteDomain,
} from "../../config/website-domain.mjs";

function withRuntimeState(state, fn) {
  const priorDir = process.env.TMC_RUNTIME_CONFIG_DIR;
  const priorBackend = process.env.BACKEND_API_URL;
  const priorDomain = process.env.WEBSITE_DOMAIN;
  const dir = mkdtempSync(join(tmpdir(), "tmc-admin-backend-url-"));
  writeFileSync(
    join(dir, "production.json"),
    JSON.stringify({ schemaVersion: 1, environment: "production", ...state }),
  );
  process.env.TMC_RUNTIME_CONFIG_DIR = dir;
  try {
    return fn();
  } finally {
    if (priorDir === undefined) delete process.env.TMC_RUNTIME_CONFIG_DIR;
    else process.env.TMC_RUNTIME_CONFIG_DIR = priorDir;
    if (priorBackend === undefined) delete process.env.BACKEND_API_URL;
    else process.env.BACKEND_API_URL = priorBackend;
    if (priorDomain === undefined) delete process.env.WEBSITE_DOMAIN;
    else process.env.WEBSITE_DOMAIN = priorDomain;
    rmSync(dir, { recursive: true, force: true });
  }
}

test("resolveProductionBackendUrl derives from platform WEBSITE_DOMAIN", () => {
  process.env.WEBSITE_DOMAIN = "wallet.example.test";
  delete process.env.BACKEND_API_URL;
  assert.equal(
    resolveProductionBackendUrl(),
    "https://api.wallet.example.test",
  );
  delete process.env.WEBSITE_DOMAIN;
});

test("resolveProductionBackendUrl falls back to runtime config when platform empty", () => {
  withRuntimeState({ WEBSITE_DOMAIN: "runtime.example.test" }, () => {
    delete process.env.WEBSITE_DOMAIN;
    delete process.env.BACKEND_API_URL;
    assert.equal(resolveWebsiteDomain(), "runtime.example.test");
    assert.equal(
      resolveProductionBackendUrl(),
      "https://api.runtime.example.test",
    );
  });
});

test("resolveProductionBackendUrl uses BACKEND_API_URL as final fallback", () => {
  withRuntimeState({ WEBSITE_DOMAIN: "" }, () => {
    delete process.env.WEBSITE_DOMAIN;
    process.env.BACKEND_API_URL = "https://api.fallback.example.test/";
    assert.equal(resolveProductionApiOrigin(), null);
    assert.equal(
      resolveProductionBackendUrl(),
      "https://api.fallback.example.test",
    );
  });
});

test("resolveProductionBackendUrl is empty when all sources missing", () => {
  withRuntimeState({ WEBSITE_DOMAIN: "" }, () => {
    delete process.env.WEBSITE_DOMAIN;
    delete process.env.BACKEND_API_URL;
    assert.equal(resolveProductionBackendUrl(), null);
  });
});
