#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  PRODUCTION_RUNTIME_FIXTURE,
  TEST_RUNTIME_DOMAIN,
  TEST_RUNTIME_PIXEL_ID,
  withProductionRuntime,
} from "./fixtures/production-runtime.mjs";
import {
  hydrateRuntimePlatformValues,
  normalizeWebsiteDomain,
  resolveMetaPixelId,
  resolveProductionApiOrigin,
  resolveWebsiteDomain,
} from "../../config/website-domain.mjs";

const TEST_PLATFORM_DOMAIN = "platform.test";
const TEST_PLATFORM_PIXEL = "987654321098765";

function withEmptyRuntimeDir(fn) {
  const prior = process.env.TMC_RUNTIME_CONFIG_DIR;
  const dir = mkdtempSync(join(tmpdir(), "tmc-runtime-empty-"));
  process.env.TMC_RUNTIME_CONFIG_DIR = dir;
  try {
    return fn();
  } finally {
    if (prior === undefined) delete process.env.TMC_RUNTIME_CONFIG_DIR;
    else process.env.TMC_RUNTIME_CONFIG_DIR = prior;
    rmSync(dir, { recursive: true, force: true });
  }
}

test("normalizeWebsiteDomain strips scheme and path", () => {
  assert.equal(
    normalizeWebsiteDomain("https://Example.COM/path"),
    "example.com",
  );
  assert.equal(normalizeWebsiteDomain("  example.com  "), "example.com");
  assert.equal(normalizeWebsiteDomain(""), null);
});

test("WEBSITE_DOMAIN: platform.env wins when both platform and runtime have values", () => {
  withProductionRuntime(() => {
    process.env.WEBSITE_DOMAIN = TEST_PLATFORM_DOMAIN;
    assert.equal(resolveWebsiteDomain(), TEST_PLATFORM_DOMAIN);
    hydrateRuntimePlatformValues();
    assert.equal(process.env.WEBSITE_DOMAIN, TEST_PLATFORM_DOMAIN);
    delete process.env.WEBSITE_DOMAIN;
  });
});

test("WEBSITE_DOMAIN: runtime used when platform.env empty", () => {
  withProductionRuntime(() => {
    delete process.env.WEBSITE_DOMAIN;
    assert.equal(resolveWebsiteDomain(), TEST_RUNTIME_DOMAIN);
    assert.equal(
      resolveProductionApiOrigin(),
      `https://api.${TEST_RUNTIME_DOMAIN}`,
    );
    hydrateRuntimePlatformValues();
    assert.equal(process.env.WEBSITE_DOMAIN, TEST_RUNTIME_DOMAIN);
  });
});

test("WEBSITE_DOMAIN: empty when both platform and runtime empty", () => {
  withEmptyRuntimeDir(() => {
    delete process.env.WEBSITE_DOMAIN;
    assert.equal(resolveWebsiteDomain(), null);
    assert.equal(resolveProductionApiOrigin(), null);
  });
});

test("META_PIXEL_ID: platform.env wins when both platform and runtime have values", () => {
  withProductionRuntime(() => {
    process.env.META_PIXEL_ID = TEST_PLATFORM_PIXEL;
    assert.equal(resolveMetaPixelId(), TEST_PLATFORM_PIXEL);
    hydrateRuntimePlatformValues();
    assert.equal(process.env.META_PIXEL_ID, TEST_PLATFORM_PIXEL);
    delete process.env.META_PIXEL_ID;
  });
});

test("META_PIXEL_ID: runtime used when platform.env empty", () => {
  withProductionRuntime(() => {
    delete process.env.META_PIXEL_ID;
    assert.equal(resolveMetaPixelId(), TEST_RUNTIME_PIXEL_ID);
    hydrateRuntimePlatformValues();
    assert.equal(process.env.META_PIXEL_ID, TEST_RUNTIME_PIXEL_ID);
  });
});

test("META_PIXEL_ID: empty when both platform and runtime empty", () => {
  withEmptyRuntimeDir(() => {
    delete process.env.META_PIXEL_ID;
    assert.equal(resolveMetaPixelId(), null);
  });
});

test("fixture uses synthetic non-production managed values", () => {
  assert.equal(PRODUCTION_RUNTIME_FIXTURE.WEBSITE_DOMAIN, TEST_RUNTIME_DOMAIN);
  assert.equal(PRODUCTION_RUNTIME_FIXTURE.META_PIXEL_ID, TEST_RUNTIME_PIXEL_ID);
});
