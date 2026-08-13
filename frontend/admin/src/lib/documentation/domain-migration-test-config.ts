import type { MigrationDomains } from "@/lib/migration-test/domains";
import { migrationUrl } from "@/lib/migration-test/domains";

export type MigrationTestStep = {
  id: string;
  step: string;
  action: string;
  expected: string;
  url?: string | ((ctx: { testSecret: string }) => string);
  kind: "browser" | "terminal" | "dashboard" | "manual";
};

export type MigrationTestPhase = {
  id: string;
  title: string;
  description: string;
  steps: MigrationTestStep[];
};

export type DomainMigrationTestConfig = {
  title: string;
  subtitle: string;
  prerequisites: string[];
  phases: MigrationTestPhase[];
  passCriteria: string[];
  failActions: string[];
};

const FBCLID = "IwAR0123456789abcdefghijklmnopqrstuvwxyz";

export function buildDomainMigrationTest(
  domains: MigrationDomains,
): DomainMigrationTestConfig {
  const { oldDomain, newDomain, oldOrigin, newOrigin, oldApi, newApi } =
    domains;

  return {
    title: `Domain migration verification — ${oldDomain} → ${newDomain}`,
    subtitle:
      "Run old-domain checks first, then new domain. Migration passes only when all automated checks pass.",
    prerequisites: [
      "Steps 1–8 complete; wallet app and backend redeployed.",
      `Render custom-domain SSL shows green for ${newDomain} and api.${newDomain}.`,
      "MARKETING_TEST_SECRET set on tmc-wallet-app — paste it below before running.",
      "Enter old and new domains above — all test URLs are generated from those values.",
    ],
    phases: [
      {
        id: "phase-a",
        title: `Phase A — Old domain (${oldDomain})`,
        description:
          "Confirms the legacy domain is no longer the primary production entry point.",
        steps: [
          {
            id: "a1",
            step: "A1",
            action: `Open ${migrationUrl(oldOrigin, "/")}`,
            expected: `Redirects to ${newDomain}, shows parking/decoy only — must NOT be the live ad destination`,
            url: migrationUrl(oldOrigin, "/"),
            kind: "browser",
          },
          {
            id: "a2",
            step: "A2",
            action: `Open ${migrationUrl(oldOrigin, "/connect")}`,
            expected:
              "Does NOT show Trust Card product — redirects to / or new domain",
            url: migrationUrl(oldOrigin, "/connect"),
            kind: "browser",
          },
          {
            id: "a3",
            step: "A3",
            action: `Open ${migrationUrl(oldOrigin, "/", "utm_source=instagram")}`,
            expected:
              "Stays on decoy or redirects — UTMs alone must NOT unlock /connect",
            url: migrationUrl(oldOrigin, "/", "utm_source=instagram"),
            kind: "browser",
          },
          {
            id: "a4",
            step: "A4",
            action: `curl -sI ${oldApi}/v1/api/settings/public`,
            expected: `Old API retired or transitional — primary API must be api.${newDomain}`,
            kind: "terminal",
          },
        ],
      },
      {
        id: "phase-b",
        title: `Phase B — New domain (${newDomain})`,
        description:
          "Confirms all production functionality works on the new domain.",
        steps: [
          {
            id: "b1",
            step: "B1",
            action: `Open ${migrationUrl(newOrigin, "/")}`,
            expected: "Decoy homepage loads; valid HTTPS (padlock)",
            url: migrationUrl(newOrigin, "/"),
            kind: "browser",
          },
          {
            id: "b2",
            step: "B2",
            action: `Open ${migrationUrl(newOrigin, "/connect")} (no session)`,
            expected:
              "Redirected to / — product blocked without marketing session",
            url: migrationUrl(newOrigin, "/connect"),
            kind: "browser",
          },
          {
            id: "b3",
            step: "B3",
            action: "Open marketing test URL (requires MARKETING_TEST_SECRET below)",
            expected:
              "Lands on /connect — Trust Card blue product UI visible",
            url: (ctx) =>
              migrationUrl(
                newOrigin,
                "/api/marketing-test",
                `token=${encodeURIComponent(ctx.testSecret || "YOUR_MARKETING_TEST_SECRET")}`,
              ),
            kind: "browser",
          },
          {
            id: "b4",
            step: "B4",
            action: `Open ${migrationUrl(newOrigin, "/", `fbclid=${FBCLID}`)}`,
            expected: "Redirects to /connect — Meta ad flow works on new domain",
            url: migrationUrl(newOrigin, "/", `fbclid=${FBCLID}`),
            kind: "browser",
          },
          {
            id: "b5",
            step: "B5",
            action: "On /connect (from B3 or B4), click logo → goes to /",
            expected:
              "Auto-redirected back to /connect (24h session active)",
            kind: "manual",
          },
          {
            id: "b6",
            step: "B6",
            action: `While session active, open ${migrationUrl(newOrigin, "/connect/privacypolicy")}`,
            expected: "Privacy policy loads (gated legal page works)",
            url: migrationUrl(newOrigin, "/connect/privacypolicy"),
            kind: "browser",
          },
          {
            id: "b7",
            step: "B7",
            action: `Open ${migrationUrl(newOrigin, "/connect", "utm_source=instagram")} (no session)`,
            expected:
              "Redirected to / — forged UTMs on /connect do not grant access",
            url: migrationUrl(newOrigin, "/connect", "utm_source=instagram"),
            kind: "browser",
          },
          {
            id: "b8",
            step: "B8",
            action: "On /connect (via B3), click Connect Wallet / Get Started",
            expected:
              'WalletConnect modal opens — no "origin not allowed" error in console',
            kind: "manual",
          },
          {
            id: "b9",
            step: "B9",
            action: `curl -s ${newApi}/v1/api/settings/public`,
            expected:
              "JSON response returned (API reachable on new API subdomain)",
            kind: "terminal",
          },
          {
            id: "b10",
            step: "B10",
            action:
              "API CORS preflight from wallet app origin (automated server check)",
            expected: `Requests from ${newOrigin} allowed — no CORS errors`,
            kind: "manual",
          },
          {
            id: "b11",
            step: "B11",
            action:
              "Render dashboard → tmc-wallet-app + tmc-backend → Custom Domains",
            expected: `${newDomain} and api.${newDomain} show Verified / SSL active`,
            kind: "dashboard",
          },
        ],
      },
    ],
    passCriteria: [
      "Phase A: old domain no longer serves Trust Card product at /connect.",
      "Phase A: old domain is not the intended ad destination.",
      "Phase B: new domain decoy at /, gated /connect, marketing test URL, and fbclid flow all work.",
      `Phase B: WalletConnect works on ${newDomain} (origin + CORS correct).`,
      `Phase B: API responds on api.${newDomain} with no CORS errors from wallet app.`,
      "Render SSL verified for all new custom domains.",
    ],
    failActions: [
      "Do not update ad URLs to the new domain until all steps pass.",
      "Re-check DNS (apex must point to Render, not shared hosting).",
      "Re-check Render env: NEXT_PUBLIC_APP_URL, BACKEND_API_URL, APP_ORIGIN — then redeploy.",
      `Re-check WalletConnect Cloud allowed origins includes ${newOrigin}.`,
      "See Troubleshooting section on this page for specific failure fixes.",
    ],
  };
}

export const MIGRATION_TEST_STEP_IDS = [
  "a1",
  "a2",
  "a3",
  "a4",
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "b6",
  "b7",
  "b8",
  "b9",
  "b10",
  "b11",
] as const;

export const MIGRATION_DOMAIN_STORAGE_KEY = "tmc-domain-migration-domains";
