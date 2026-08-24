#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTmcEnv } from "../config/load-env.mjs";
import { resolveProductionBackendUrl } from "../config/website-domain.mjs";
import { getProductionConfig } from "../deploy/config-engine/index.mjs";
import {
  readPlatformDefaults,
  validateMetaPixelId,
  validateWebsiteDomainInput,
} from "../deploy/config-engine/validators.mjs";

const DEPLOY_PASSWORD = "0000";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const presetFlag = argv.find((arg) => arg.startsWith("--preset="));
  const preset = presetFlag?.split("=")[1];
  if (preset && !["domain", "pixel", "ask"].includes(preset)) {
    throw new Error(`Unknown --preset value "${preset}". Use domain, pixel, or ask.`);
  }
  return { preset: preset ?? "ask" };
}

function logPrefix() {
  return "[production-config]";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveApiCredentials() {
  const baseUrl = resolveProductionBackendUrl();
  const apiKey =
    process.env.PRODUCTION_ADMIN_API_KEY?.trim() ||
    process.env.ADMIN_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Production API not configured. Set WEBSITE_DOMAIN in config/platform.env and PRODUCTION_ADMIN_API_KEY in env/profiles/production/admin.env (or ADMIN_API_KEY on Vercel).",
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

async function loadCurrentConfigFromApi() {
  const { baseUrl, apiKey } = resolveApiCredentials();
  const response = await fetch(`${baseUrl}/v1/api/admin/production-config`, {
    headers: {
      accept: "application/json",
      "x-admin-api-key": apiKey,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Production API status failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }
  const body = await response.json();
  const state = body.state ?? body;
  return {
    WEBSITE_DOMAIN: String(state.WEBSITE_DOMAIN ?? "").trim(),
    META_PIXEL_ID: String(state.META_PIXEL_ID ?? "").trim(),
    source: state.source ?? "DATABASE",
  };
}

async function loadCurrentConfig() {
  try {
    return await loadCurrentConfigFromApi();
  } catch (apiError) {
    console.warn(
      `${logPrefix()} API status unavailable (${apiError instanceof Error ? apiError.message : apiError}); falling back to runtime files.`,
    );
    try {
      const fileState = await getProductionConfig("production");
      return {
        WEBSITE_DOMAIN: fileState.WEBSITE_DOMAIN?.trim() ?? "",
        META_PIXEL_ID: fileState.META_PIXEL_ID?.trim() ?? "",
        source: fileState.source ?? "RUNTIME_CONFIG",
      };
    } catch (fileError) {
      throw new Error(
        `${apiError instanceof Error ? apiError.message : apiError}\n${fileError instanceof Error ? fileError.message : fileError}\nRun: ./scripts/config-update.sh init --from-compiled`,
      );
    }
  }
}

async function fetchLiveMetaPixelId(domain) {
  const websiteUrl = `https://${domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")}`;
  try {
    const response = await fetch(websiteUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "TrustMyCard-ProductionConfig/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return { pixelId: null, error: `HTTP ${response.status}` };
    }
    const html = await response.text();
    const initMatch = html.match(
      /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{15,16})['"]\s*\)/i,
    );
    if (initMatch?.[1]) return { pixelId: initMatch[1] };
    const beaconMatch = html.match(
      /facebook\.com\/tr\?id=(\d{15,16})(?:&|["'])/i,
    );
    return { pixelId: beaconMatch?.[1] ?? null };
  } catch (error) {
    return {
      pixelId: null,
      error: error instanceof Error ? error.message : "Unable to reach website",
    };
  }
}

function printCurrentValues(config, livePixel) {
  const prefix = logPrefix();
  const domain = config.WEBSITE_DOMAIN?.trim() || "(not configured)";
  const pixel = config.META_PIXEL_ID?.trim() || "(not configured)";
  const source = config.source ?? "UNRESOLVED";

  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log("  PRODUCTION WEBSITE CONFIGURATION");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`${prefix} live production domain: ${domain}`);
  console.log(`${prefix} configured Meta Pixel ID: ${pixel}`);
  if (domain !== "(not configured)") {
    if (livePixel?.pixelId) {
      console.log(`${prefix} live website Meta Pixel ID: ${livePixel.pixelId}`);
    } else if (livePixel?.error) {
      console.log(
        `${prefix} live website Meta Pixel ID: unavailable (${livePixel.error})`,
      );
    } else {
      console.log(`${prefix} live website Meta Pixel ID: not found in HTML`);
    }
  }
  console.log(`${prefix} resolved source: ${source}`);
  if (source === "DATABASE") {
    console.log(
      `${prefix} note: Meta Pixel is stored in AppSettings (admin API). No wallet restart required.`,
    );
  }
  console.log("════════════════════════════════════════════════════════════");
  console.log("");
}

function warnPlatformOverride(key, platformDefaults) {
  const value = platformDefaults[key]?.trim();
  if (!value) return;
  console.warn(
    `${logPrefix()} warning: config/platform.env sets ${key}=${value}. Runtime updates may not take effect until that value is cleared.`,
  );
}

async function askScope(rl, preset) {
  if (preset === "domain") return "domain";
  if (preset === "pixel") return "pixel";

  const answer = (
    await rl.question(
      "What do you want to change?\n  1) Domain\n  2) Meta Pixel ID\n  3) Both\nEnter choice [1-3]: ",
    )
  )
    .trim()
    .toLowerCase();

  if (answer === "1" || answer === "domain") return "domain";
  if (answer === "2" || answer === "pixel" || answer === "meta pixel id") {
    return "pixel";
  }
  if (answer === "3" || answer === "both") return "both";
  throw new Error("Update cancelled: invalid choice.");
}

function scopeLabel(scope) {
  if (scope === "domain") return "Domain";
  if (scope === "pixel") return "Meta Pixel ID";
  return "Domain and Meta Pixel ID";
}

async function requireConfirmation(rl, scope) {
  const answer = (
    await rl.question(
      `Proceed with updating ${scopeLabel(scope)}? Type Y to confirm or N to cancel: `,
    )
  )
    .trim()
    .toUpperCase();
  if (answer !== "Y") {
    throw new Error("Update cancelled.");
  }
}

async function promptDomain(rl, currentDomain) {
  while (true) {
    const raw = (
      await rl.question(
        `New production domain (current: ${currentDomain || "not configured"}): `,
      )
    ).trim();
    if (!raw) {
      console.log(`${logPrefix()} domain is required.`);
      continue;
    }
    const candidate = raw.includes("://") ? raw : `https://${raw}`;
    try {
      const { hostname } = validateWebsiteDomainInput(candidate);
      if (hostname === currentDomain) {
        console.log(`${logPrefix()} new domain matches the current value.`);
        continue;
      }
      return hostname;
    } catch (error) {
      console.log(`${logPrefix()} invalid domain: ${error.message}`);
    }
  }
}

async function promptPixel(rl, currentPixel) {
  while (true) {
    const raw = (
      await rl.question(
        `New Meta Pixel ID (current: ${currentPixel || "not configured"}): `,
      )
    ).trim();
    if (!raw) {
      console.log(`${logPrefix()} Meta Pixel ID is required.`);
      continue;
    }
    try {
      const pixelId = validateMetaPixelId(raw);
      if (pixelId === currentPixel) {
        console.log(`${logPrefix()} new Meta Pixel ID matches the current value.`);
        continue;
      }
      return pixelId;
    } catch (error) {
      console.log(`${logPrefix()} invalid Meta Pixel ID: ${error.message}`);
    }
  }
}

async function requirePassword(rl) {
  const password = (await rl.question("Enter deployment password: ")).trim();
  if (password !== DEPLOY_PASSWORD) {
    throw new Error("Update cancelled: incorrect deployment password.");
  }
}

function runDomainConfigUpdate(value, actor) {
  const script = join(repoRoot, "scripts", "config-update.sh");
  console.log("");
  console.log(
    `${logPrefix()} running domain config deploy: ./scripts/config-update.sh domain https://${value}`,
  );
  console.log("");

  const result = spawnSync(
    script,
    ["domain", `https://${value}`, "--actor", actor, "--source", "VSCODE_TASK"],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, TMC_ENV: "production" },
    },
  );

  if (result.status !== 0) {
    throw new Error(`config-update domain failed (exit ${result.status ?? "unknown"})`);
  }
}

async function waitForApiChange(changeId, actor) {
  const { baseUrl, apiKey } = resolveApiCredentials();
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${baseUrl}/v1/api/admin/production-config/history?limit=30`,
      {
        headers: {
          accept: "application/json",
          "x-admin-api-key": apiKey,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) {
      await sleep(800);
      continue;
    }
    const history = await response.json();
    if (!Array.isArray(history)) {
      await sleep(800);
      continue;
    }
    const entry = history.find((row) => row.changeId === changeId);
    if (!entry) {
      await sleep(800);
      continue;
    }
    if (entry.result === "SUCCESS") return entry;
    if (entry.result === "FAILED" || entry.result === "ROLLED_BACK") {
      throw new Error(entry.error || `Pixel update failed (${entry.result})`);
    }
    await sleep(800);
  }
  throw new Error(
    "Timed out waiting for production API to confirm the Meta Pixel update.",
  );
}

async function runPixelApiUpdate(pixelId, actor) {
  const { baseUrl, apiKey } = resolveApiCredentials();
  console.log("");
  console.log(
    `${logPrefix()} updating Meta Pixel via production API (AppSettings database)`,
  );
  console.log(`${logPrefix()} POST ${baseUrl}/v1/api/admin/production-config/pixel`);
  console.log("");

  const response = await fetch(`${baseUrl}/v1/api/admin/production-config/pixel`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-admin-api-key": apiKey,
      "x-admin-actor": actor,
    },
    body: JSON.stringify({ pixel: pixelId }),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Pixel API update failed (${response.status}): ${text.slice(0, 300)}`,
    );
  }

  let changeId;
  try {
    const body = JSON.parse(text);
    changeId = body.changeId;
  } catch {
    throw new Error("Pixel API did not return a valid JSON response.");
  }
  if (!changeId) {
    throw new Error("Pixel API did not return a change id.");
  }

  console.log(`${logPrefix()} change id: ${changeId} — waiting for confirmation…`);
  await waitForApiChange(changeId, actor);
}

async function main() {
  process.env.TMC_ENV = process.env.TMC_ENV || "production";
  loadTmcEnv("admin");

  const { preset } = parseArgs(process.argv.slice(2));
  const config = await loadCurrentConfig();
  const platformDefaults = readPlatformDefaults(repoRoot);
  const currentDomain = config.WEBSITE_DOMAIN?.trim() ?? "";
  const currentPixel = config.META_PIXEL_ID?.trim() ?? "";
  const livePixel = currentDomain
    ? await fetchLiveMetaPixelId(currentDomain)
    : null;

  printCurrentValues(config, livePixel);

  const rl = readline.createInterface({ input, output });
  const actor = `${process.env.USER ?? "unknown"}@vscode-task`;
  try {
    const scope = await askScope(rl, preset);
    await requireConfirmation(rl, scope);

    const domainUpdates = [];
    const pixelUpdates = [];

    if (scope === "domain" || scope === "both") {
      warnPlatformOverride("WEBSITE_DOMAIN", platformDefaults);
      const nextDomain = await promptDomain(rl, currentDomain);
      domainUpdates.push(nextDomain);
    }
    if (scope === "pixel" || scope === "both") {
      const nextPixel = await promptPixel(rl, currentPixel);
      pixelUpdates.push(nextPixel);
    }

    await requirePassword(rl);

    for (const nextDomain of domainUpdates) {
      runDomainConfigUpdate(nextDomain, actor);
    }
    for (const nextPixel of pixelUpdates) {
      await runPixelApiUpdate(nextPixel, actor);
    }

    const refreshed = await loadCurrentConfig();
    console.log("");
    console.log("════════════════════════════════════════════════════════════");
    console.log("  UPDATE SUCCEEDED");
    console.log("════════════════════════════════════════════════════════════");
    for (const nextDomain of domainUpdates) {
      console.log(
        `${logPrefix()} production domain: ${currentDomain || "(none)"} → ${refreshed.WEBSITE_DOMAIN}`,
      );
      console.log(
        `${logPrefix()} domain change: configuration-only deploy completed (Caddy/wallet may restart).`,
      );
    }
    for (const nextPixel of pixelUpdates) {
      console.log(
        `${logPrefix()} Meta Pixel ID: ${currentPixel || "(none)"} → ${refreshed.META_PIXEL_ID}`,
      );
      console.log(
        `${logPrefix()} pixel change: saved to AppSettings — live on next website page load (no wallet restart).`,
      );
    }
    console.log("════════════════════════════════════════════════════════════");
    console.log("");
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error("════════════════════════════════════════════════════════════");
  console.error("  UPDATE FAILED");
  console.error("════════════════════════════════════════════════════════════");
  console.error(`${logPrefix()} ${error instanceof Error ? error.message : error}`);
  console.error("════════════════════════════════════════════════════════════");
  console.error("");
  process.exitCode = 1;
});
