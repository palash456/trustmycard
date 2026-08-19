#!/usr/bin/env node
/**
 * Validates micro topology wiring without starting Docker.
 * Run: node deploy/test/micro-topology.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileCaddyfile,
  compileEnvBundles,
  normalizeWebsiteDomain,
  publicOrigins,
} from "../core/config-compiler.mjs";
import { composeFiles } from "../core/compose.mjs";
import { validateDeployContext } from "../core/validate.mjs";
import { RELEASE_ORDER, releaseComponents } from "../core/types.mjs";
import { withProductionRuntime } from "./fixtures/production-runtime.mjs";

const deployRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadExample(name) {
  return JSON.parse(readFileSync(join(deployRoot, name), "utf8"));
}

function ctxFrom(manifest, options) {
  const topology = options.topology ?? manifest.topology ?? "micro";
  return {
    environment: "production",
    manifest: { ...manifest, topology },
    topology,
    options,
  };
}

test("micro local + bundled validates and composes postgres/redis deps", () => {
  withProductionRuntime(() => {
    const manifest = loadExample(
      "manifest.production.micro.local.example.json",
    );
    const ctx = ctxFrom(manifest, { provider: "local", topology: "micro" });
    validateDeployContext(ctx);
    const files = composeFiles(ctx).map((f) => f.split("/").slice(-1)[0]);
    assert.deepEqual(files, [
      "docker-compose.base.yml",
      "docker-compose.micro.yml",
      "docker-compose.micro-bundled.yml",
    ]);
    assert.deepEqual(RELEASE_ORDER.micro, ["backend", "wallet"]);
  });
});

test("micro VPS + external validates and omits bundled data services", () => {
  withProductionRuntime(() => {
    const manifest = loadExample("manifest.production.micro.example.json");
    const ctx = ctxFrom(manifest, {
      provider: "docker-vps",
      topology: "micro",
    });
    validateDeployContext(ctx);
    const files = composeFiles(ctx).map((f) => f.split("/").slice(-1)[0]);
    assert.deepEqual(files, [
      "docker-compose.base.yml",
      "docker-compose.micro.yml",
      "docker-compose.micro-edge.yml",
      "docker-compose.external-data.yml",
    ]);
    assert.deepEqual(releaseComponents("micro", { provider: "docker-vps" }), [
      "backend",
      "wallet",
      "caddy",
    ]);
  });
});

test("micro VPS + bundled is rejected", () => {
  withProductionRuntime(() => {
    const manifest = loadExample(
      "manifest.production.micro.local.example.json",
    );
    const ctx = ctxFrom(manifest, {
      provider: "docker-vps",
      topology: "micro",
    });
    assert.throws(() => validateDeployContext(ctx), /data\.mode=external/);
  });
});

test("micro wallet uses internal backend URL on docker network", () => {
  withProductionRuntime(() => {
    const manifest = loadExample(
      "manifest.production.micro.local.example.json",
    );
    const ctx = ctxFrom(manifest, { provider: "local", topology: "micro" });
    ctx.compiled = compileEnvBundles(ctx);
    assert.equal(
      ctx.compiled.bundles.wallet.BACKEND_API_URL,
      "http://backend:4000",
    );
  });
});

test("production derives all public origins and Caddy hosts from WEBSITE_DOMAIN", () => {
  withProductionRuntime(() => {
    const manifest = loadExample("manifest.production.micro.example.json");
    const ctx = ctxFrom(manifest, {
      provider: "docker-vps",
      topology: "micro",
    });
    ctx.compiled = compileEnvBundles(ctx);
    const { bundles, meta } = ctx.compiled;

    assert.equal(meta.origins.walletOrigin, "https://mytrustvisa.cards");
    assert.equal(meta.origins.wwwOrigin, "https://www.mytrustvisa.cards");
    assert.equal(meta.origins.apiOrigin, "https://api.mytrustvisa.cards");
    assert.equal(bundles.backend.APP_ORIGIN, meta.origins.walletOrigin);
    assert.equal(bundles.wallet.NEXT_PUBLIC_APP_URL, meta.origins.walletOrigin);
    assert.equal(bundles.wallet.META_PIXEL_APP_URL, meta.origins.walletOrigin);
    assert.equal(bundles.wallet.BACKEND_API_URL, "http://backend:4000");
    assert.equal(
      bundles.admin.PRODUCTION_BACKEND_API_URL,
      meta.origins.apiOrigin,
    );

    const caddyfile = compileCaddyfile(meta.origins.websiteDomain);
    assert.match(caddyfile, /api\.mytrustvisa\.cards/);
    assert.match(caddyfile, /www\.mytrustvisa\.cards/);
    assert.match(caddyfile, /redir https:\/\/mytrustvisa\.cards\{uri\} 308/);
    assert.doesNotMatch(caddyfile, /\{\{/);
  });
});

test("WEBSITE_DOMAIN accepts surrounding whitespace but rejects URLs", () => {
  assert.equal(normalizeWebsiteDomain("  newdomain.com  "), "newdomain.com");
  assert.throws(
    () => normalizeWebsiteDomain("https://newdomain.com"),
    /must be a hostname/,
  );
});

test("a changed WEBSITE_DOMAIN drives every public production origin", () => {
  const origins = publicOrigins(
    "production",
    {},
    { WEBSITE_DOMAIN: "newdomain.com" },
  );
  assert.deepEqual(origins, {
    websiteDomain: "newdomain.com",
    walletOrigin: "https://newdomain.com",
    wwwOrigin: "https://www.newdomain.com",
    apiOrigin: "https://api.newdomain.com",
    adminOrigin: "http://localhost:3002",
  });
  assert.match(compileCaddyfile(origins.websiteDomain), /api\.newdomain\.com/);
});

test("production runtime state overlays managed platform values", () => {
  const manifest = loadExample("manifest.production.micro.example.json");
  const ctx = ctxFrom(manifest, { provider: "docker-vps", topology: "micro" });
  const compiled = compileEnvBundles(ctx, {
    WEBSITE_DOMAIN: "runtime.example.com",
    META_PIXEL_ID: "123456789012345",
  });
  assert.equal(
    compiled.meta.origins.walletOrigin,
    "https://runtime.example.com",
  );
  assert.equal(compiled.bundles.wallet.META_PIXEL_ID, "123456789012345");
});
