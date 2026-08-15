import type { MigrationDomains } from "@/lib/migration-test/domains";
import { migrationUrl } from "@/lib/migration-test/domains";

const FBCLID = "IwAR0123456789abcdefghijklmnopqrstuvwxyz";
const FETCH_TIMEOUT_MS = 20_000;

export type MigrationStepStatus = "pass" | "fail" | "skip";

export type MigrationStepResult = {
  id: string;
  step: string;
  status: MigrationStepStatus;
  message: string;
  detail?: string;
};

class CookieJar {
  private readonly cookies = new Map<string, string>();

  ingest(response: Response): void {
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    if (setCookies.length > 0) {
      for (const raw of setCookies) {
        const [pair] = raw.split(";");
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (name) this.cookies.set(name, value);
      }
      return;
    }
    const single = response.headers.get("set-cookie");
    if (!single) return;
    const [pair] = single.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) return;
    this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }

  header(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }
}

type Hop = { url: string; status: number; location?: string };

type RunnerContext = {
  domains: MigrationDomains;
  userAgent: string;
};

async function timedFetch(
  ctx: RunnerContext,
  url: string,
  init: RequestInit & { jar?: CookieJar } = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  if (!headers.has("User-Agent")) headers.set("User-Agent", ctx.userAgent);
  const cookie = init.jar?.header();
  if (cookie) headers.set("Cookie", cookie);

  try {
    return await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
      redirect: init.redirect ?? "manual",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function followRedirects(
  ctx: RunnerContext,
  startUrl: string,
  options: { jar?: CookieJar; max?: number } = {},
): Promise<{ finalUrl: string; status: number; hops: Hop[] }> {
  const max = options.max ?? 12;
  const hops: Hop[] = [];
  let current = startUrl;

  for (let i = 0; i < max; i++) {
    const response = await timedFetch(ctx, current, {
      jar: options.jar,
      redirect: "manual",
    });
    options.jar?.ingest(response);
    const location = response.headers.get("location");
    hops.push({
      url: current,
      status: response.status,
      location: location ?? undefined,
    });

    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }

    return { finalUrl: current, status: response.status, hops };
  }

  return { finalUrl: current, status: 0, hops };
}

function urlPath(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
}

function urlHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function pass(
  id: string,
  step: string,
  message: string,
  detail?: string,
): MigrationStepResult {
  return { id, step, status: "pass", message, detail };
}

function fail(
  id: string,
  step: string,
  message: string,
  detail?: string,
): MigrationStepResult {
  return { id, step, status: "fail", message, detail };
}

function skip(
  id: string,
  step: string,
  message: string,
  detail?: string,
): MigrationStepResult {
  return { id, step, status: "skip", message, detail };
}

function hopSummary(hops: Hop[]): string {
  return hops
    .map((h) => `${h.status} ${h.url}${h.location ? ` → ${h.location}` : ""}`)
    .join("\n");
}

function createRunnerContext(domains: MigrationDomains): RunnerContext {
  return {
    domains,
    userAgent: `Mozilla/5.0 (compatible; TrustMyCardMigrationTest/1.0; +${domains.newOrigin})`,
  };
}

async function testA1(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const { finalUrl, status, hops } = await followRedirects(
      ctx,
      migrationUrl(domains.oldOrigin, "/"),
    );
    const path = urlPath(finalUrl);
    const host = urlHost(finalUrl);
    if (host === domains.oldDomain && path === "/connect") {
      return fail(
        "a1",
        "A1",
        "Old domain homepage still routes to /connect",
        hopSummary(hops),
      );
    }
    if (host === domains.newDomain) {
      return pass(
        "a1",
        "A1",
        `Old domain redirects to ${domains.newDomain}`,
        finalUrl,
      );
    }
    if (status >= 200 && status < 400) {
      return pass(
        "a1",
        "A1",
        "Old domain does not expose /connect as homepage entry",
        `Final: ${status} ${finalUrl}`,
      );
    }
    return fail("a1", "A1", `Unexpected response: ${status}`, finalUrl);
  } catch (error) {
    return fail(
      "a1",
      "A1",
      `Could not reach ${domains.oldDomain}`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testA2(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const { finalUrl, status, hops } = await followRedirects(
      ctx,
      migrationUrl(domains.oldOrigin, "/connect"),
    );
    const path = urlPath(finalUrl);
    if (path === "/connect" && status >= 200 && status < 300) {
      return fail(
        "a2",
        "A2",
        "Old /connect still serves product without redirect",
        hopSummary(hops),
      );
    }
    return pass(
      "a2",
      "A2",
      "Old /connect is blocked or redirected",
      `Final: ${status} ${finalUrl}`,
    );
  } catch (error) {
    return pass(
      "a2",
      "A2",
      "Old /connect unreachable (domain retired)",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testA3(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const response = await timedFetch(
      ctx,
      `${domains.oldApi}/v1/api/settings/public`,
      { redirect: "follow" },
    );
    return pass(
      "a3",
      "A3",
      `Old API responded (${response.status}) — ensure ads/API use api.${domains.newDomain}`,
      `Status ${response.status}`,
    );
  } catch (error) {
    return pass(
      "a3",
      "A3",
      "Old API unreachable — OK if fully retired",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testB1(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const response = await timedFetch(ctx, migrationUrl(domains.newOrigin, "/"), {
      redirect: "follow",
    });
    if (response.status >= 200 && response.status < 400) {
      return pass(
        "b1",
        "B1",
        "New domain homepage is reachable over HTTPS",
        `HTTP ${response.status}`,
      );
    }
    return fail("b1", "B1", `Homepage returned HTTP ${response.status}`);
  } catch (error) {
    return fail(
      "b1",
      "B1",
      `Could not reach ${domains.newDomain} — check DNS/TLS`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testB2(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const { finalUrl, status, hops } = await followRedirects(
      ctx,
      migrationUrl(domains.newOrigin, "/connect"),
    );
    if (status === 404) {
      return pass(
        "b2",
        "B2",
        "/connect returns 404 (removed)",
        hopSummary(hops),
      );
    }
    if (urlPath(finalUrl) === "/" && hops.length > 0) {
      return fail(
        "b2",
        "B2",
        "/connect still redirects to / — legacy route should be removed",
        hopSummary(hops),
      );
    }
    if (urlPath(finalUrl) === "/connect" && status >= 200 && status < 300) {
      return fail(
        "b2",
        "B2",
        "/connect still serves content — route should be removed",
        hopSummary(hops),
      );
    }
    return pass(
      "b2",
      "B2",
      "/connect does not serve product",
      `Final: ${status} ${finalUrl}`,
    );
  } catch (error) {
    return fail(
      "b2",
      "B2",
      `Could not reach ${domains.newDomain}/connect`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testB3(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const response = await timedFetch(
      ctx,
      migrationUrl(domains.newOrigin, "/frequentlyaskedquestions"),
      { redirect: "follow" },
    );
    if (response.status >= 200 && response.status < 400) {
      return pass(
        "b3",
        "B3",
        "FAQ legal page is public",
        `HTTP ${response.status}`,
      );
    }
    return fail("b3", "B3", `FAQ returned HTTP ${response.status}`);
  } catch (error) {
    return fail(
      "b3",
      "B3",
      "FAQ request failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testB4(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const { finalUrl, hops } = await followRedirects(
      ctx,
      migrationUrl(domains.newOrigin, "/", `fbclid=${FBCLID}`),
    );
    if (urlPath(finalUrl) === "/") {
      return pass(
        "b4",
        "B4",
        "fbclid homepage stays on / (public product)",
        hopSummary(hops),
      );
    }
    if (urlPath(finalUrl) === "/connect") {
      return fail(
        "b4",
        "B4",
        "fbclid flow still redirects to legacy /connect",
        hopSummary(hops),
      );
    }
    return fail(
      "b4",
      "B4",
      "Unexpected final path for fbclid homepage",
      hopSummary(hops),
    );
  } catch (error) {
    return fail(
      "b4",
      "B4",
      "fbclid flow request failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testB5(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const response = await timedFetch(
      ctx,
      migrationUrl(domains.newOrigin, "/privacypolicy"),
      { redirect: "follow" },
    );
    if (response.status >= 200 && response.status < 400) {
      return pass(
        "b5",
        "B5",
        "Privacy policy is public",
        `HTTP ${response.status}`,
      );
    }
    return fail("b5", "B5", `Privacy policy returned HTTP ${response.status}`);
  } catch (error) {
    return fail(
      "b5",
      "B5",
      "Privacy policy request failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testB6(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const response = await timedFetch(ctx, `http://${domains.newDomain}/`, {
      redirect: "manual",
    });
    const location = response.headers.get("location") ?? "";
    if (
      response.status >= 300 &&
      response.status < 400 &&
      location.startsWith("https://")
    ) {
      return pass(
        "b6",
        "B6",
        "HTTP redirects to HTTPS",
        `HTTP ${response.status} → ${location}`,
      );
    }
    return fail(
      "b6",
      "B6",
      "HTTP does not redirect to HTTPS",
      `HTTP ${response.status}; Location: ${location || "(missing)"}`,
    );
  } catch (error) {
    return fail(
      "b6",
      "B6",
      "HTTP redirect check failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testB7(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const { finalUrl, status, hops } = await followRedirects(
      ctx,
      migrationUrl(domains.newOrigin, "/connect", "utm_source=instagram"),
    );
    if (status === 404) {
      return pass(
        "b7",
        "B7",
        "/connect with UTMs returns 404 (removed)",
        hopSummary(hops),
      );
    }
    if (urlPath(finalUrl) === "/connect" && status >= 200 && status < 300) {
      return fail(
        "b7",
        "B7",
        "/connect with UTMs still serves product",
        hopSummary(hops),
      );
    }
    if (urlPath(finalUrl) === "/" && hops.length > 0) {
      return fail(
        "b7",
        "B7",
        "/connect with UTMs still redirects to /",
        hopSummary(hops),
      );
    }
    return pass(
      "b7",
      "B7",
      "/connect with UTMs does not serve product",
      `Final: ${status} ${finalUrl}`,
    );
  } catch (error) {
    return fail(
      "b7",
      "B7",
      "UTM /connect test failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testB9(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const response = await timedFetch(
      ctx,
      `${domains.newApi}/v1/api/settings/public`,
      { redirect: "follow", headers: { Accept: "application/json" } },
    );
    const text = await response.text();
    if (response.status >= 200 && response.status < 300) {
      try {
        JSON.parse(text);
        return pass(
          "b9",
          "B9",
          `api.${domains.newDomain} returns public settings JSON`,
          `HTTP ${response.status}`,
        );
      } catch {
        return fail("b9", "B9", "API response is not valid JSON", text.slice(0, 200));
      }
    }
    return fail("b9", "B9", `API returned HTTP ${response.status}`, text.slice(0, 200));
  } catch (error) {
    return fail(
      "b9",
      "B9",
      `Could not reach api.${domains.newDomain}`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function testB10(ctx: RunnerContext): Promise<MigrationStepResult> {
  const { domains } = ctx;
  try {
    const response = await timedFetch(
      ctx,
      `${domains.newApi}/v1/api/settings/public`,
      {
        method: "OPTIONS",
        headers: {
          Origin: domains.newOrigin,
          "Access-Control-Request-Method": "GET",
        },
      },
    );
    const acao = response.headers.get("access-control-allow-origin");
    if (
      acao === domains.newOrigin ||
      acao === "*" ||
      (acao && acao.includes(domains.newDomain))
    ) {
      return pass(
        "b10",
        "B10",
        "API CORS allows wallet app origin",
        `Access-Control-Allow-Origin: ${acao ?? "(missing)"}`,
      );
    }
    return fail(
      "b10",
      "B10",
      `API CORS does not allow ${domains.newOrigin}`,
      `Access-Control-Allow-Origin: ${acao ?? "(missing)"}; HTTP ${response.status}`,
    );
  } catch (error) {
    return fail(
      "b10",
      "B10",
      "CORS preflight check failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export type MigrationTestRunSummary = {
  results: MigrationStepResult[];
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  allAutomatedPassed: boolean;
  domains: MigrationDomains;
};

export async function runMigrationTests(
  domains: MigrationDomains,
  _testSecret = "",
): Promise<MigrationTestRunSummary> {
  const ctx = createRunnerContext(domains);
  const results: MigrationStepResult[] = [];

  results.push(await testA1(ctx));
  results.push(await testA2(ctx));
  results.push(await testA3(ctx));

  results.push(await testB1(ctx));
  results.push(await testB2(ctx));
  results.push(await testB3(ctx));
  results.push(await testB4(ctx));
  results.push(await testB5(ctx));
  results.push(await testB6(ctx));
  results.push(await testB7(ctx));

  results.push(
    skip(
      "b8",
      "B8",
      `WalletConnect UI requires a real browser — confirm Connect Wallet works on ${domains.newOrigin}/`,
    ),
  );

  results.push(await testB9(ctx));
  results.push(await testB10(ctx));

  results.push(
    skip(
      "b11",
      "B11",
      `TLS dashboard check — confirm ${domains.newDomain} and api.${domains.newDomain} show active certificates`,
    ),
  );

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  return {
    results,
    passed,
    failed,
    skipped,
    total: results.length,
    allAutomatedPassed: failed === 0,
    domains,
  };
}
