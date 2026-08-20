#!/usr/bin/env node
import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveManagedPlatformValues } from "../config-engine/validators.mjs";

test("resolveManagedPlatformValues: platform wins when both set (WEBSITE_DOMAIN)", () => {
  const resolved = resolveManagedPlatformValues(
    { WEBSITE_DOMAIN: "platform.test", META_PIXEL_ID: "" },
    { WEBSITE_DOMAIN: "runtime.test", META_PIXEL_ID: "" },
  );
  assert.equal(resolved.WEBSITE_DOMAIN, "platform.test");
});

test("resolveManagedPlatformValues: runtime fallback when platform empty (WEBSITE_DOMAIN)", () => {
  const resolved = resolveManagedPlatformValues(
    { WEBSITE_DOMAIN: "", META_PIXEL_ID: "" },
    { WEBSITE_DOMAIN: "runtime.test", META_PIXEL_ID: "" },
  );
  assert.equal(resolved.WEBSITE_DOMAIN, "runtime.test");
});

test("resolveManagedPlatformValues: empty when both unset (WEBSITE_DOMAIN)", () => {
  const resolved = resolveManagedPlatformValues(
    { WEBSITE_DOMAIN: "", META_PIXEL_ID: "" },
    { WEBSITE_DOMAIN: "", META_PIXEL_ID: "" },
  );
  assert.equal(resolved.WEBSITE_DOMAIN, "");
});

test("resolveManagedPlatformValues: platform wins when both set (META_PIXEL_ID)", () => {
  const resolved = resolveManagedPlatformValues(
    { WEBSITE_DOMAIN: "", META_PIXEL_ID: "111111111111111" },
    { WEBSITE_DOMAIN: "", META_PIXEL_ID: "222222222222222" },
  );
  assert.equal(resolved.META_PIXEL_ID, "111111111111111");
});

test("resolveManagedPlatformValues: runtime fallback when platform empty (META_PIXEL_ID)", () => {
  const resolved = resolveManagedPlatformValues(
    { WEBSITE_DOMAIN: "", META_PIXEL_ID: "" },
    { WEBSITE_DOMAIN: "", META_PIXEL_ID: "222222222222222" },
  );
  assert.equal(resolved.META_PIXEL_ID, "222222222222222");
});

test("resolveManagedPlatformValues: empty when both unset (META_PIXEL_ID)", () => {
  const resolved = resolveManagedPlatformValues(
    { WEBSITE_DOMAIN: "", META_PIXEL_ID: "" },
    null,
  );
  assert.equal(resolved.META_PIXEL_ID, "");
});
