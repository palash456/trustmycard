import assert from "node:assert/strict";
import { test } from "node:test";

import { getMetaPixelEnvConfig, normalizeAppOrigin } from "./meta-pixel-env.ts";

test("normalizeAppOrigin strips path and trailing slash via origin", () => {
  assert.equal(
    normalizeAppOrigin("https://mytrustvisa.cards/"),
    "https://mytrustvisa.cards",
  );
  assert.equal(
    normalizeAppOrigin("https://mytrustvisa.cards/connect"),
    "https://mytrustvisa.cards",
  );
});

test("normalizeAppOrigin rejects malformed URLs", () => {
  assert.equal(normalizeAppOrigin(""), null);
  assert.equal(normalizeAppOrigin("not-a-url"), null);
  assert.equal(normalizeAppOrigin("javascript:alert(1)"), null);
});

test("normalizeAppOrigin with requireHttps rejects http", () => {
  assert.equal(
    normalizeAppOrigin("http://mytrustvisa.cards", { requireHttps: true }),
    null,
  );
  assert.equal(
    normalizeAppOrigin("https://mytrustvisa.cards", { requireHttps: true }),
    "https://mytrustvisa.cards",
  );
});

test("getMetaPixelEnvConfig accepts canonical https apex match", () => {
  process.env.TMC_ENV = "production";
  process.env.META_PIXEL_ID = "2158981564683913";
  process.env.META_PIXEL_APP_URL = "https://mytrustvisa.cards";
  process.env.NEXT_PUBLIC_APP_URL = "https://mytrustvisa.cards/";

  const config = getMetaPixelEnvConfig();
  assert.equal(config?.pixelId, "2158981564683913");
});

test("getMetaPixelEnvConfig rejects http canonical or app URL", () => {
  process.env.TMC_ENV = "production";
  process.env.META_PIXEL_ID = "2158981564683913";
  process.env.META_PIXEL_APP_URL = "https://mytrustvisa.cards";
  process.env.NEXT_PUBLIC_APP_URL = "http://mytrustvisa.cards";
  assert.equal(getMetaPixelEnvConfig(), null);

  process.env.META_PIXEL_APP_URL = "http://mytrustvisa.cards";
  process.env.NEXT_PUBLIC_APP_URL = "https://mytrustvisa.cards";
  assert.equal(getMetaPixelEnvConfig(), null);
});

test("getMetaPixelEnvConfig rejects wrong host and www subdomain", () => {
  process.env.TMC_ENV = "production";
  process.env.META_PIXEL_ID = "2158981564683913";
  process.env.META_PIXEL_APP_URL = "https://mytrustvisa.cards";
  process.env.NEXT_PUBLIC_APP_URL = "https://evil.com";
  assert.equal(getMetaPixelEnvConfig(), null);

  process.env.NEXT_PUBLIC_APP_URL = "https://www.mytrustvisa.cards";
  assert.equal(getMetaPixelEnvConfig(), null);
});

test("getMetaPixelEnvConfig rejects development", () => {
  process.env.TMC_ENV = "development";
  process.env.META_PIXEL_ID = "2158981564683913";
  process.env.META_PIXEL_APP_URL = "https://mytrustvisa.cards";
  process.env.NEXT_PUBLIC_APP_URL = "https://mytrustvisa.cards";
  assert.equal(getMetaPixelEnvConfig(), null);
});
