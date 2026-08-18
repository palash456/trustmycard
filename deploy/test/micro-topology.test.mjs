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
import { compileEnvBundles } from "../core/config-compiler.mjs";
import { composeFiles } from "../core/compose.mjs";
import { validateDeployContext } from "../core/validate.mjs";
import { RELEASE_ORDER, releaseComponents } from "../core/types.mjs";

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
  const manifest = loadExample("manifest.production.micro.local.example.json");
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

test("micro VPS + external validates and omits bundled data services", () => {
  const manifest = loadExample("manifest.production.micro.example.json");
  const ctx = ctxFrom(manifest, { provider: "docker-vps", topology: "micro" });
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

test("micro VPS + bundled is rejected", () => {
  const manifest = loadExample("manifest.production.micro.local.example.json");
  const ctx = ctxFrom(manifest, { provider: "docker-vps", topology: "micro" });
  assert.throws(() => validateDeployContext(ctx), /data\.mode=external/);
});

test("micro wallet uses internal backend URL on docker network", () => {
  const manifest = loadExample("manifest.production.micro.local.example.json");
  const ctx = ctxFrom(manifest, { provider: "local", topology: "micro" });
  ctx.compiled = compileEnvBundles(ctx);
  assert.equal(
    ctx.compiled.bundles.wallet.BACKEND_API_URL,
    "http://backend:4000",
  );
});
