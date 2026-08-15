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
      `DNS + TLS active for ${newDomain} and api.${newDomain}.`,
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
            expected: `Redirects to ${newDomain} or no longer serves live product`,
            url: migrationUrl(oldOrigin, "/"),
            kind: "browser",
          },
          {
            id: "a2",
            step: "A2",
            action: `Open ${migrationUrl(oldOrigin, "/connect")}`,
            expected:
              "Does NOT serve Trust Card product — redirects to / or new domain",
            url: migrationUrl(oldOrigin, "/connect"),
            kind: "browser",
          },
          {
            id: "a3",
            step: "A3",
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
            expected: "Product homepage loads; valid HTTPS (padlock)",
            url: migrationUrl(newOrigin, "/"),
            kind: "browser",
          },
          {
            id: "b2",
            step: "B2",
            action: `Open ${migrationUrl(newOrigin, "/connect")}`,
            expected: "Redirected to / — legacy /connect path",
            url: migrationUrl(newOrigin, "/connect"),
            kind: "browser",
          },
          {
            id: "b3",
            step: "B3",
            action: `Open ${migrationUrl(newOrigin, "/frequentlyaskedquestions")}`,
            expected: "FAQ legal page loads (public)",
            url: migrationUrl(newOrigin, "/frequentlyaskedquestions"),
            kind: "browser",
          },
          {
            id: "b4",
            step: "B4",
            action: `Open ${migrationUrl(newOrigin, "/", `fbclid=${FBCLID}`)}`,
            expected: "Stays on / — product is public (no session gate)",
            url: migrationUrl(newOrigin, "/", `fbclid=${FBCLID}`),
            kind: "browser",
          },
          {
            id: "b5",
            step: "B5",
            action: `Open ${migrationUrl(newOrigin, "/privacypolicy")}`,
            expected: "Privacy policy loads (public legal page)",
            url: migrationUrl(newOrigin, "/privacypolicy"),
            kind: "browser",
          },
          {
            id: "b6",
            step: "B6",
            action: `curl -sI http://${newDomain}/`,
            expected: "HTTP redirects to HTTPS (308/301)",
            kind: "terminal",
          },
          {
            id: "b7",
            step: "B7",
            action: `Open ${migrationUrl(newOrigin, "/connect", "utm_source=instagram")}`,
            expected: "Redirected to / regardless of UTMs",
            url: migrationUrl(newOrigin, "/connect", "utm_source=instagram"),
            kind: "browser",
          },
          {
            id: "b8",
            step: "B8",
            action: "On /, click Connect Wallet / Get Started",
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
            action: "Hosting dashboard — custom domains / TLS",
            expected: `${newDomain} and api.${newDomain} show active TLS`,
            kind: "dashboard",
          },
        ],
      },
    ],
    passCriteria: [
      "Phase A: old domain no longer serves live Trust Card product.",
      "Phase B: new domain product at /, /connect redirects, legal pages public.",
      `Phase B: WalletConnect works on ${newDomain} (origin + CORS correct).`,
      `Phase B: API responds on api.${newDomain} with no CORS errors from wallet app.`,
      "TLS verified for all new domains.",
    ],
    failActions: [
      "Do not update ad URLs to the new domain until all steps pass.",
      "Re-check DNS (apex and api must point to the wallet/API host).",
      "Re-check env: NEXT_PUBLIC_APP_URL, BACKEND_API_URL, APP_ORIGIN — then redeploy.",
      `Re-check WalletConnect Cloud allowed origins includes ${newOrigin}.`,
      "See Troubleshooting and Public Site & Domain docs for specific failure fixes.",
    ],
  };
}

export const MIGRATION_TEST_STEP_IDS = [
  "a1",
  "a2",
  "a3",
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
