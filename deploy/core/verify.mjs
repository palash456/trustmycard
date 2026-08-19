const VERIFY_RETRIES = 15;
const VERIFY_DELAY_MS = 2000;
const DOMAIN_MIGRATION_VERIFY_RETRIES = 90;
const DOMAIN_MIGRATION_VERIFY_DELAY_MS = 4000;

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
    console.log(
      `[verify] ${retryPolicy.reason}; retrying up to ~${maxWaitSec}s`,
    );
  }

  const results = [];
  for (const check of checks) {
    const result = await fetchCheckWithRetries(check, retryPolicy);
    results.push(result);
    const icon = result.ok ? "OK" : "FAIL";
    console.log(
      `[verify] ${icon} ${check.name} (${result.status}) ${check.url}`,
    );
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    throw new Error(
      `Verification failed for: ${failed.map((f) => f.name).join(", ")}`,
    );
  }

  console.log("[verify] all checks passed");
  return results;
}

async function fetchCheckWithRetries(check, retryPolicy) {
  let last = await fetchCheck(check);
  for (let attempt = 1; attempt < retryPolicy.retries && !last.ok; attempt++) {
    if (
      retryPolicy.reason &&
      attempt % 15 === 0 &&
      last.status === 0 &&
      last.error
    ) {
      console.log(
        `[verify] still waiting (${attempt}/${retryPolicy.retries - 1}): ${check.name} — ${last.error}`,
      );
    }
    await sleep(retryPolicy.delayMs);
    last = await fetchCheck(check);
  }
  return last;
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

export function printManualChecklist(manifest, options = {}) {
  const walletOrigin =
    options.walletOrigin ?? manifest.domains?.wallet ?? "https://<apex>";
  console.log("\n[manual] post-deploy checklist:");
  console.log("  - DNS: A records @, api, www → VPS IP (not Hostinger shared hosting)");
  console.log("  - Disconnect any Hostinger 'connected website' on this domain");
  console.log("  - Caddy TLS active; www → apex 308 redirect");
  console.log(`  - WalletConnect allowed origin: ${walletOrigin}`);
  console.log("  - APP_ORIGIN / NEXT_PUBLIC_APP_URL match apex URL");
  console.log("  - Meta ads landing URL = apex / (not /connect)");
  console.log("  - Do NOT upload marketing to Hostinger public_html");
  console.log(
    "  - See docs/infrastructure/hosting-abuse-resilience.md if recovering from a ban",
  );
}
