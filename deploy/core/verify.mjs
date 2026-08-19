const VERIFY_RETRIES = 15;
const VERIFY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const results = [];
  for (const check of checks) {
    const result = await fetchCheckWithRetries(check);
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

async function fetchCheckWithRetries(check) {
  let last = await fetchCheck(check);
  for (let attempt = 1; attempt < VERIFY_RETRIES && !last.ok; attempt++) {
    await sleep(VERIFY_DELAY_MS);
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
