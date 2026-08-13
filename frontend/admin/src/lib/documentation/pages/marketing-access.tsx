import {
  DocCallout,
  DocCode,
  DocFlow,
  DocLink,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const marketingAccessPage: DocPage = {
  slug: "marketing-access",
  title: "Domain Security & Access",
  description:
    "mytrustvisa.cards — URL map, /connect gating, Meta ads, env vars, developer test, DNS, and all access cases.",
  keywords: [
    "marketing",
    "connect",
    "decoy",
    "fbclid",
    "meta",
    "instagram",
    "mytrustvisa",
    "trustvisa",
    "domain",
    "security",
    "hostinger",
    "render",
    "session",
    "dns",
    "api",
  ],
  sections: [
    {
      id: "master-guide",
      title: "Master guide (repo)",
      content: (
        <>
          <DocP>
            The complete standalone reference is{" "}
            <DocCode>docs/infrastructure/mytrustvisa-domain-security.md</DocCode>
            . Everything below mirrors that guide for in-app reading.
          </DocP>
          <DocCallout variant="tip">
            Migrated from trustvisa.cards. Migration checklist:{" "}
            <DocLink href="/documentation/domain-migration">Domain Migration</DocLink>
            . Media buyers:{" "}
            <DocCode>docs/marketing/meta-ads-setup-guide.md</DocCode>.
          </DocCallout>
        </>
      ),
    },
    {
      id: "production-domain",
      title: "Production URL map",
      content: (
        <DocTable
          headers={["URL", "What", "Gated?"]}
          rows={[
            ["https://mytrustvisa.cards/", "Travixa decoy (public cover site)", "No"],
            [
              "https://mytrustvisa.cards/connect",
              "Trust Card product (wallet + marketing UI)",
              "Yes — tv_ms session",
            ],
            [
              "https://mytrustvisa.cards/connect/privacypolicy",
              "Privacy policy",
              "Yes",
            ],
            [
              "https://mytrustvisa.cards/connect/frequentlyaskedquestions",
              "FAQ",
              "Yes",
            ],
            ["https://api.mytrustvisa.cards", "Nest API (tmc-backend)", "API auth"],
            ["https://www.mytrustvisa.cards", "Optional www", "—"],
          ]}
        />
      ),
    },
    {
      id: "dns-layout",
      title: "DNS & hosting (Render)",
      content: (
        <>
          <DocTable
            headers={["Host", "Points to", "Serves"]}
            rows={[
              [
                "mytrustvisa.cards (apex)",
                "Render tmc-wallet-app",
                "Decoy / + /connect + /api/* BFF",
              ],
              [
                "api.mytrustvisa.cards",
                "Render tmc-backend",
                "Nest API — required for wallet",
              ],
              [
                "www.mytrustvisa.cards",
                "Optional — apex or Hostinger",
                "Prefer apex for legal pages under /connect/*",
              ],
            ]}
          />
          <DocCallout variant="warning">
            Both apex <strong>and</strong> <DocCode>api</DocCode> subdomain need
            CNAME records on Render. Missing <DocCode>api</DocCode> DNS causes
            wallet app <DocCode>502 fetch failed</DocCode> on all backend calls.
          </DocCallout>
        </>
      ),
    },
    {
      id: "connect-gating",
      title: "Who can access what (all cases)",
      content: (
        <>
          <DocP>
            <DocCode>/connect</DocCode> requires a valid signed marketing session
            cookie (<DocCode>tv_ms</DocCode>). Duration:{" "}
            <DocCode>MARKETING_SESSION_TTL_MINUTES</DocCode> (production:{" "}
            <DocCode>1440</DocCode> = 24 hours).
          </DocP>
          <DocTable
            headers={["Visitor action", "Result"]}
            rows={[
              ["Opens mytrustvisa.cards", "Decoy (Travixa)"],
              ["Types /connect manually (no session)", "Redirected to / (decoy)"],
              ["/connect?utm_source=instagram (no session)", "Redirected to /"],
              ["/?utm_source=instagram (no fbclid)", "Decoy — UTMs do not grant access"],
              [
                "Meta ad click → /?fbclid=...",
                "Verify → exchange → /connect (marketing session)",
              ],
              [
                "Google ad click → /?gclid=...",
                "Server-side gclid verify → /connect",
              ],
              ["fbclid on /connect directly", "Redirected to / — never grants access"],
              ["TikTok / LinkedIn click IDs only", "Decoy — fail closed"],
              ["Valid session + logo click → /", "Auto-redirect back to /connect"],
              ["Developer /api/marketing-test?token=SECRET", "Same session → /connect"],
              ["Invalid test secret", "404, no session"],
              ["Session expired", "/connect blocked until new ad click or test URL"],
              ["New incognito → /connect", "Decoy"],
            ]}
          />
        </>
      ),
    },
    {
      id: "meta-ads",
      title: "Meta / Instagram ads (real users)",
      content: (
        <>
          <DocTable
            headers={["Setting", "Value"]}
            rows={[
              ["Ad destination URL", "https://mytrustvisa.cards/"],
              ["Do NOT use", "https://mytrustvisa.cards/connect"],
              ["Meta Pixel ID", "2158981564683913 (in code — /connect only)"],
              ["Do NOT paste pixel script", "Already installed — /connect only"],
              ["Unlock mechanism", "fbclid auto-appended by Meta on ad clicks"],
              ["Session duration", "MARKETING_SESSION_TTL_MINUTES=1440 (24h)"],
            ]}
          />
          <DocFlow
            steps={[
              "User clicks Meta ad → https://mytrustvisa.cards/?fbclid=...",
              "Brief Travixa decoy flash on / (intentional).",
              "Server verify → one-time token (90s) → exchange.",
              "Set tv_ms cookie → redirect https://mytrustvisa.cards/connect.",
              "Trust Card product loads + Meta Pixel PageView fires.",
            ]}
          />
        </>
      ),
    },
    {
      id: "session-ttl",
      title: "Session TTL vs wallet session",
      content: (
        <>
          <DocTable
            headers={["Variable", "Where", "Controls", "Production value"]}
            rows={[
              [
                "MARKETING_SESSION_TTL_MINUTES",
                "platform.env + Render tmc-wallet-app",
                "/connect gate (tv_ms cookie) — ads + dev test",
                "1440 (24h)",
              ],
              [
                "WALLET_SESSION_TTL_MS",
                "platform.env → backend",
                "Wallet API session after connect",
                "1800000 (30 min)",
              ],
            ]}
          />
          <DocCallout variant="warning">
            These are <strong>different features</strong>. Do not confuse them.
            Set <DocCode>MARKETING_SESSION_TTL_MINUTES</DocCode> once on Render —
            only one row (no duplicates). Mirror the same value in{" "}
            <DocCode>env/profiles/production/platform.env</DocCode>.
          </DocCallout>
        </>
      ),
    },
    {
      id: "render-env",
      title: "Render env — tmc-wallet-app",
      content: (
        <DocPre>{`NEXT_PUBLIC_APP_URL=https://mytrustvisa.cards
BACKEND_API_URL=https://api.mytrustvisa.cards
NEXT_PUBLIC_MARKETING_URL=https://www.mytrustvisa.cards
NEXT_PUBLIC_PROJECT_ID=<walletconnect project id>
MARKETING_SESSION_SECRET=<HMAC secret>
MARKETING_SESSION_TTL_MINUTES=1440
MARKETING_TEST_SECRET=tvmt_<openssl rand -hex 32>   # never commit

# Google Ads only (skip for Meta-only)
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=`}</DocPre>
      ),
    },
    {
      id: "backend-env",
      title: "Render env — tmc-backend",
      content: (
        <DocPre>{`APP_ORIGIN=https://mytrustvisa.cards
ADMIN_ORIGIN=https://admin.mytrustvisa.cards  # or localhost for local admin`}</DocPre>
      ),
    },
    {
      id: "walletconnect",
      title: "WalletConnect Cloud",
      content: (
        <DocP>
          Allowed origin: <DocCode>https://mytrustvisa.cards</DocCode>. Redeploy
          wallet app after changing <DocCode>NEXT_PUBLIC_APP_URL</DocCode> (baked
          at build time).
        </DocP>
      ),
    },
    {
      id: "developer-test",
      title: "Developer production test",
      content: (
        <>
          <DocP>
            Set <DocCode>MARKETING_TEST_SECRET</DocCode> on Render only. Open in
            incognito — never link from UI or commit the secret:
          </DocP>
          <DocPre>{`https://mytrustvisa.cards/api/marketing-test?token=<MARKETING_TEST_SECRET>`}</DocPre>
          <DocTable
            headers={["Outcome", "Result"]}
            rows={[
              ["Valid secret", "tv_ms cookie → redirects to /connect"],
              ["Invalid/missing", "404"],
              ["Wrong redirect host (localhost:10000)", "Fix NEXT_PUBLIC_APP_URL + redeploy"],
              ["Rate limit", "30 failed attempts / 15 min / IP (valid token unlimited)"],
            ]}
          />
          <DocP>Local: http://localhost:3000/api/marketing-test?token=LOCAL_SECRET</DocP>
        </>
      ),
    },
    {
      id: "verification-flow",
      title: "Server verification flow",
      content: (
        <DocFlow
          steps={[
            "User lands on / with click ID — UTMs alone never grant access.",
            "Middleware sets homepage attestation (tv_mh) → /api/marketing/verify.",
            "Platform adapter verifies (Meta: format + attestation; Google: click_view API).",
            "On success: 90s one-time token, bound to IP + User-Agent.",
            "/api/marketing/exchange → tv_ms cookie (MARKETING_SESSION_TTL_MINUTES).",
            "Redirect to /connect via NEXT_PUBLIC_APP_URL (not localhost:10000).",
          ]}
        />
      ),
    },
    {
      id: "platform-adapters",
      title: "Platform adapters",
      content: (
        <DocTable
          headers={["Platform", "Click ID", "Verification", "Notes"]}
          rows={[
            ["Meta / Instagram", "fbclid", "Format + homepage attestation", "Not cryptographically verified"],
            ["Google", "gclid", "Google Ads API click_view", "Requires GOOGLE_ADS_* env"],
            ["Google iOS", "gbraid / wbraid", "Fail closed", "No server-side verify"],
            ["TikTok", "ttclid", "Fail closed", "No inbound verify API"],
            ["LinkedIn", "li_fat_id", "Fail closed", "No inbound verify API"],
          ]}
        />
      ),
    },
    {
      id: "common-failures",
      title: "Common failures",
      content: (
        <DocTable
          headers={["Symptom", "Cause", "Fix"]}
          rows={[
            [
              "502 fetch failed on wallet",
              "api.mytrustvisa.cards DNS missing",
              "CNAME api → Render backend; custom domain on tmc-backend",
            ],
            [
              "Redirect to localhost:10000/connect",
              "NEXT_PUBLIC_APP_URL wrong",
              "Set https://mytrustvisa.cards, redeploy wallet app",
            ],
            [
              "Ad click stays on decoy",
              "Ad URL is /connect or no fbclid",
              "Use https://mytrustvisa.cards/; check MARKETING_SESSION_SECRET",
            ],
            [
              "Duplicate MARKETING_SESSION_TTL_MINUTES",
              "Two env rows on Render",
              "Keep one row only (1440 for production)",
            ],
            [
              "CORS errors",
              "APP_ORIGIN mismatch",
              "APP_ORIGIN=https://mytrustvisa.cards on tmc-backend",
            ],
            [
              "Meta Pixel no events",
              "Pixel on /connect only",
              "Complete ad flow or use test URL first",
            ],
          ]}
        />
      ),
    },
    {
      id: "search-exclusion",
      title: "Search engine exclusion",
      content: (
        <DocTable
          headers={["Layer", "Paths"]}
          rows={[
            ["robots.txt", "/connect, /api/marketing-test, /api/marketing/"],
            ["HTML robots metadata", "/connect/*"],
            ["X-Robots-Tag headers", "/connect, /connect/*, marketing API routes"],
          ]}
        />
      ),
    },
    {
      id: "key-files",
      title: "Key implementation files",
      content: (
        <DocTable
          headers={["File", "Role"]}
          rows={[
            ["frontend/website/middleware.ts", "Route gating, click-ID detection"],
            ["frontend/website/src/lib/marketing/session-config.ts", "MARKETING_SESSION_TTL_MINUTES"],
            ["frontend/website/src/lib/marketing/session.ts", "Signed tv_ms cookie"],
            ["frontend/website/src/lib/marketing/public-url.ts", "Render redirect fix (NEXT_PUBLIC_APP_URL)"],
            ["frontend/website/src/lib/marketing/http.ts", "redirectConnect / redirectHome"],
            ["frontend/website/src/app/api/marketing-test/route.ts", "Developer test bypass"],
            ["frontend/website/src/components/ConnectMetaPixel.tsx", "Meta Pixel on /connect only"],
          ]}
        />
      ),
    },
    {
      id: "smoke-tests",
      title: "Post-deploy smoke tests",
      content: (
        <DocPre>{`# API + DNS
curl -s https://api.mytrustvisa.cards/v1/api/settings/public | head
curl -s https://mytrustvisa.cards/api/settings/public | head

# Decoy vs gated
curl -sI https://mytrustvisa.cards/ | head -3
curl -sI https://mytrustvisa.cards/connect | head -3

# SEO exclusion
curl -s https://mytrustvisa.cards/robots.txt | grep -E 'connect|marketing'

# Browser (incognito)
# 1. /connect → redirect to / (decoy)
# 2. /api/marketing-test?token=SECRET → /connect
# 3. Ad preview with fbclid → /connect
# 4. WalletConnect on /connect — no origin error`}</DocPre>
      ),
    },
  ],
};
