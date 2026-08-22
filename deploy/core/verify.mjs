const VERIFY_RETRIES = 15;
const VERIFY_DELAY_MS = 2000;
/** Domain migration: short window for ACME; fail fast with diagnostics — do not loop on stale DNS. */
const DOMAIN_MIGRATION_VERIFY_RETRIES = 12;
const DOMAIN_MIGRATION_VERIFY_DELAY_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function verifyRetryPolicy(ctx) {
  if (ctx?.changedKey === "WEBSITE_DOMAIN") {
    return {
      retries: DOMAIN_MIGRATION_VERIFY_RETRIES,
      delayMs: DOMAIN_MIGRATION_VERIFY_DELAY_MS,
      reason: "domain migration (waiting for Caddy TLS/ACME)",
    };
  }
  return {
    retries: VERIFY_RETRIES,
    delayMs: VERIFY_DELAY_MS,
    reason: null,
  };
}

export async function verifyDeployment(ctx) {
  const { manifest, compiled } = ctx;
  const topology = manifest.topology ?? "budget";
  const origins = compiled?.meta.origins;
  const api = (origins?.apiOrigin ?? manifest.domains?.api).replace(/\/$/, "");
  const wallet = (origins?.walletOrigin ?? manifest.domains?.wallet).replace(
    /\/$/,
    "",
  );
  const admin = (origins?.adminOrigin ?? manifest.domains?.admin).replace(
    /\/$/,
    "",
  );
  const log = (message) => {
    console.log(message);
    ctx.onLog?.(message);
  };
  const logError = (message) => {
    console.error(message);
    ctx.onLog?.(message);
  };

  const checks = [
    {
      name: "api settings/public",
      url: `${api}/v1/api/settings/public`,
      expectStatus: 200,
    },
    {
      name: "wallet BFF settings/public",
      url: `${wallet}/api/settings/public`,
      expectStatus: 200,
    },
  ];

  if (topology !== "micro") {
    checks.push({
      name: "admin login page",
      url: `${admin}/login`,
      expectStatus: [200, 307, 308],
    });
  }

  const retryPolicy = verifyRetryPolicy(ctx);
  if (retryPolicy.reason) {
    const maxWaitSec = Math.ceil(
      (retryPolicy.retries - 1) * (retryPolicy.delayMs / 1000),
    );
    log(`[verify] ${retryPolicy.reason}; retrying up to ~${maxWaitSec}s`);
  }

  const results = [];
  for (const check of checks) {
    const result = await fetchCheckWithRetries(check, retryPolicy, log);
    results.push(result);
    const icon = result.ok ? "OK" : "FAIL";
    log(`[verify] ${icon} ${check.name} (${result.status}) ${check.url}`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    for (const f of failed) {
      printVerifyFailureHint(f, api, wallet, logError);
    }
    throw new Error(
      `Verification failed for: ${failed.map((f) => f.name).join(", ")}`,
    );
  }

  log("[verify] all checks passed");
  return results;
}

async function fetchCheckWithRetries(check, retryPolicy, log) {
  let last = await fetchCheck(check);
  for (let attempt = 1; attempt < retryPolicy.retries && !last.ok; attempt++) {
    if (
      retryPolicy.reason &&
      attempt % 15 === 0 &&
      last.status === 0 &&
      last.error
    ) {
      log(
        `[verify] still waiting (${attempt}/${retryPolicy.retries - 1}): ${check.name} — ${last.error}`,
      );
    }
    await sleep(retryPolicy.delayMs);
    last = await fetchCheck(check);
  }
  return last;
}

function printVerifyFailureHint(result, apiOrigin, walletOrigin, logError) {
  const host = (() => {
    try {
      return new URL(result.url ?? apiOrigin).hostname;
    } catch {
      return "";
    }
  })();
  logError(`[verify] hint for ${result.name}:`);
  if (result.status === 0) {
    logError(
      "  Likely DNS/TLS/connectivity — confirm the hostname resolves to the production VPS:",
    );
    logError(`  dig +short ${host || "<hostname>"} A`);
    logError(`  curl -I ${walletOrigin}/`);
    logError(`  curl ${apiOrigin}/v1/api/settings/public`);
    logError(
      "  Retired domains (e.g. cryptovisa.site) are not checked — update deploy/runtime-config/production.json WEBSITE_DOMAIN if verify still hits an old host.",
    );
  } else {
    logError(
      `  HTTP ${result.status} from ${result.url} — check Caddy routing and container health on the VPS.`,
    );
  }
}

async function fetchCheck(check) {
  const allowed = Array.isArray(check.expectStatus)
    ? check.expectStatus
    : [check.expectStatus];
  try {
    const res = await fetch(check.url, { redirect: "manual" });
    return {
      name: check.name,
      ok: allowed.includes(res.status),
      status: res.status,
    };
  } catch (err) {
    return { name: check.name, ok: false, status: 0, error: err.message };
  }
}

function isApexWebsiteDomain(websiteDomain) {
  return String(websiteDomain ?? "").split(".").length <= 2;
}

function resolveDeployMode(options = {}) {
  if (options.skipBuild && options.skipImages) return "config-only";
  if (options.skipMigrate) return "skip-migrate";
  return "full";
}

export function printManualChecklist(manifest, options = {}) {
  const origins = options.origins ?? {};
  const walletOrigin =
    origins.walletOrigin ??
    options.walletOrigin ??
    manifest.domains?.wallet ??
    "https://<WEBSITE_DOMAIN>";
  const apiOrigin =
    origins.apiOrigin ??
    options.apiOrigin ??
    manifest.domains?.api ??
    "https://api.<WEBSITE_DOMAIN>";
  const websiteDomain =
    origins.websiteDomain ??
    options.websiteDomain ??
    (() => {
      try {
        return new URL(walletOrigin).hostname;
      } catch {
        return "<WEBSITE_DOMAIN>";
      }
    })();
  const apiHost = (() => {
    try {
      return new URL(apiOrigin).hostname;
    } catch {
      return `api.${websiteDomain}`;
    }
  })();
  const deployMode = options.deployMode ?? resolveDeployMode(options);
  const apex = isApexWebsiteDomain(websiteDomain);

  console.log("\n[manual] post-deploy checklist:");
  console.log(
    "  - DNS: Cloudflare A records → VPS IP (deploy/provider.credentials.env → VPS_HOST)",
  );
  console.log(`      ${websiteDomain} (wallet)`);
  console.log(`      ${apiHost} (API)`);
  if (apex) {
    console.log(`      www.${websiteDomain} (308 redirect → ${websiteDomain})`);
    console.log(
      `  - Caddy TLS active; www.${websiteDomain} → ${websiteDomain} (308)`,
    );
  } else {
    console.log(
      `  - Caddy TLS active for ${websiteDomain} + ${apiHost} (subdomain host — no www block)`,
    );
  }
  console.log(
    "  - Runtime config: deploy/runtime-config/production.json auto-synced on deploy",
  );
  console.log(
    "    (npm run config:sync-vps only if edited offline; domain/pixel via production:domain:update / production:meta-pixel:update)",
  );
  console.log(
    `  - WalletConnect allowed origin: ${walletOrigin} (NEXT_PUBLIC_APP_URL)`,
  );
  console.log(`  - API origin: ${apiOrigin}; APP_ORIGIN matches wallet URL`);
  console.log(
    "  - Meta Pixel / ads landing URL: homepage / (not /connect); META_PIXEL_ID in runtime config or config/platform.env",
  );
  console.log(
    "  - Platform policy (eligibility, wallets, flags): config/platform.env — rebuild wallet after NEXT_PUBLIC_* or locale edits",
  );
  if (deployMode === "config-only") {
    console.log(
      "  - Config-only deploy: images unchanged; NEXT_PUBLIC_* / locale edits still need a full wallet rebuild",
    );
  } else if (deployMode === "skip-migrate") {
    console.log(
      "  - Skipped DB migrate this run — run full deploy when Prisma migrations are pending",
    );
  }
  console.log(
    "  - Admin panel: deploy separately (npm run deploy:admin / Prod: Deploy Admin)",
  );
  console.log(
    "  - VPS creds live in deploy/provider.credentials.env only — never in config/platform.env",
  );
}
