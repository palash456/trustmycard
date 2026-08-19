#!/usr/bin/env node
import assert from "node:assert/strict";
import { test } from "node:test";
import { withProductionRuntime } from "./fixtures/production-runtime.mjs";
import {
  hydrateRuntimePlatformValues,
  normalizeWebsiteDomain,
  resolveProductionApiOrigin,
  resolveWebsiteDomain,
} from "../../config/website-domain.mjs";

test("normalizeWebsiteDomain strips scheme and path", () => {
  assert.equal(normalizeWebsiteDomain("https://Example.COM/path"), "example.com");
  assert.equal(normalizeWebsiteDomain("  mytrustvisa.cards  "), "mytrustvisa.cards");
  assert.equal(normalizeWebsiteDomain(""), null);
});

test("resolveWebsiteDomain and API origin read production runtime state", () => {
  withProductionRuntime(() => {
    delete process.env.WEBSITE_DOMAIN;
    hydrateRuntimePlatformValues();
    assert.equal(process.env.WEBSITE_DOMAIN, "mytrustvisa.cards");
    assert.equal(resolveWebsiteDomain(), "mytrustvisa.cards");
    assert.equal(
      resolveProductionApiOrigin(),
      "https://api.mytrustvisa.cards",
    );
  });
});

test("process.env.WEBSITE_DOMAIN wins over runtime state", () => {
  withProductionRuntime(() => {
    process.env.WEBSITE_DOMAIN = "override.example.com";
    assert.equal(resolveWebsiteDomain(), "override.example.com");
    assert.equal(
      resolveProductionApiOrigin(),
      "https://api.override.example.com",
    );
    delete process.env.WEBSITE_DOMAIN;
  });
});
