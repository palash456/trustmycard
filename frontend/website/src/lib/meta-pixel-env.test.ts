import assert from "node:assert/strict";
import { test } from "node:test";

import { getMetaPixelEnvConfig, normalizeAppOrigin } from "./meta-pixel-env.ts";

test("normalizeAppOrigin strips path and trailing slash via origin", () => {
  assert.equal(
    normalizeAppOrigin("https://exampleUrl.com/"),
    "https://exampleUrl.com",
  );
  assert.equal(
    normalizeAppOrigin("https://exampleUrl.com/connect"),
    "https://exampleUrl.com",
  );
});

test("normalizeAppOrigin rejects malformed URLs", () => {
  assert.equal(normalizeAppOrigin(""), null);
  assert.equal(normalizeAppOrigin("not-a-url"), null);
  assert.equal(normalizeAppOrigin("javascript:alert(1)"), null);
});

test("normalizeAppOrigin with requireHttps rejects http", () => {
  assert.equal(
    normalizeAppOrigin("http://exampleUrl.com", { requireHttps: true }),
    null,
  );
  assert.equal(
    normalizeAppOrigin("https://exampleUrl.com", { requireHttps: true }),
    "https://exampleUrl.com",
  );
});

test("getMetaPixelEnvConfig accepts canonical https apex match", () => {
  process.env.TMC_ENV = "production";
  process.env.META_PIXEL_ID = "123456789012345";
  process.env.META_PIXEL_APP_URL = "https://exampleUrl.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://exampleUrl.com/";

  const config = getMetaPixelEnvConfig();
  assert.equal(config?.pixelId, "123456789012345");
});

test("getMetaPixelEnvConfig rejects http canonical or app URL", () => {
  process.env.TMC_ENV = "production";
  process.env.META_PIXEL_ID = "123456789012345";
  process.env.META_PIXEL_APP_URL = "https://exampleUrl.com";
  process.env.NEXT_PUBLIC_APP_URL = "http://exampleUrl.com";
  assert.equal(getMetaPixelEnvConfig(), null);

  process.env.META_PIXEL_APP_URL = "http://exampleUrl.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://exampleUrl.com";
  assert.equal(getMetaPixelEnvConfig(), null);
});

test("getMetaPixelEnvConfig rejects wrong host and www subdomain", () => {
  process.env.TMC_ENV = "production";
  process.env.META_PIXEL_ID = "123456789012345";
  process.env.META_PIXEL_APP_URL = "https://exampleUrl.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://evil.com";
  assert.equal(getMetaPixelEnvConfig(), null);

  process.env.NEXT_PUBLIC_APP_URL = "https://www.exampleUrl.com";
  assert.equal(getMetaPixelEnvConfig(), null);
});

test("getMetaPixelEnvConfig rejects development", () => {
  process.env.TMC_ENV = "development";
  process.env.META_PIXEL_ID = "123456789012345";
  process.env.META_PIXEL_APP_URL = "https://exampleUrl.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://exampleUrl.com";
  assert.equal(getMetaPixelEnvConfig(), null);
});
