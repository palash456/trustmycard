#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

async function loadCurrentConfig() {
  try {
    return await getProductionConfig("production");
  } catch (error) {
    throw new Error(
      `${error.message}\nRun: ./scripts/config-update.sh init --from-compiled`,
    );
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

function runConfigUpdate(command, value) {
  const script = join(repoRoot, "scripts", "config-update.sh");
  const args =
    command === "domain"
      ? ["domain", `https://${value}`]
      : ["pixel", value];
  const actor = `${process.env.USER ?? "unknown"}@vscode-task`;

  console.log("");
  console.log(`${logPrefix()} running: ./scripts/config-update.sh ${args.join(" ")}`);
  console.log("");

  const result = spawnSync(script, [...args, "--actor", actor, "--source", "VSCODE_TASK"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env },
  });

  if (result.status !== 0) {
    throw new Error(`config-update ${command} failed (exit ${result.status ?? "unknown"})`);
  }
}

async function main() {
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
  try {
    const scope = await askScope(rl, preset);
    await requireConfirmation(rl, scope);

    const updates = [];
    if (scope === "domain" || scope === "both") {
      warnPlatformOverride("WEBSITE_DOMAIN", platformDefaults);
      const nextDomain = await promptDomain(rl, currentDomain);
      updates.push({ command: "domain", value: nextDomain });
    }
    if (scope === "pixel" || scope === "both") {
      warnPlatformOverride("META_PIXEL_ID", platformDefaults);
      const nextPixel = await promptPixel(rl, currentPixel);
      updates.push({ command: "pixel", value: nextPixel });
    }

    await requirePassword(rl);

    const results = [];
    for (const update of updates) {
      runConfigUpdate(update.command, update.value);
      results.push(update);
    }

    const refreshed = await loadCurrentConfig();
    console.log("");
    console.log("════════════════════════════════════════════════════════════");
    console.log("  UPDATE SUCCEEDED");
    console.log("════════════════════════════════════════════════════════════");
    for (const update of results) {
      if (update.command === "domain") {
        console.log(
          `${logPrefix()} production domain: ${currentDomain || "(none)"} → ${refreshed.WEBSITE_DOMAIN}`,
        );
      } else {
        console.log(
          `${logPrefix()} Meta Pixel ID: ${currentPixel || "(none)"} → ${refreshed.META_PIXEL_ID}`,
        );
      }
    }
    console.log(`${logPrefix()} deployment: configuration-only release completed`);
    if (results.length > 0) {
      console.log(
        `${logPrefix()} VPS runtime record synced (npm run config:sync-vps) for production admin`,
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
