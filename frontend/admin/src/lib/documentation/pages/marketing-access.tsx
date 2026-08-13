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
  title: "Marketing Access & Domains",
  description:
    "mytrustvisa.cards layout, /connect gating, Meta ads, env vars, and developer test access.",
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
    "hostinger",
    "render",
    "session",
  ],
  sections: [
    {
      id: "production-domain",
      title: "Production domain (mytrustvisa.cards)",
      content: (
        <>
          <DocTable
            headers={["URL", "What"]}
            rows={[
              ["https://mytrustvisa.cards/", "Travixa decoy (public cover site)"],
              [
                "https://mytrustvisa.cards/connect",
                "Trust Card product (wallet + marketing UI)",
              ],
              [
                "https://mytrustvisa.cards/connect/privacypolicy",
                "Privacy policy (gated — requires marketing session)",
              ],
              [
                "https://mytrustvisa.cards/connect/frequentlyaskedquestions",
                "FAQ (gated)",
              ],
              ["https://api.mytrustvisa.cards", "Nest API (Render tmc-backend)"],
            ]}
          />
          <DocCallout variant="tip">
            Migrated from trustvisa.cards. See{" "}
            <DocLink href="/documentation/domain-migration">
              Domain Migration
            </DocLink>{" "}
            for the full Hostinger + Render checklist. Repo guides:{" "}
            <DocCode>docs/infrastructure/domain-migration.md</DocCode>
            , <DocCode>docs/marketing/meta-ads-setup-guide.md</DocCode>.
          </DocCallout>
        </>
      ),
    },
    {
      id: "dns-layout",
      title: "DNS & hosting",
      content: (
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
              "Nest API",
            ],
            [
              "www.mytrustvisa.cards",
              "Optional — apex or Hostinger",
              "Prefer apex for legal pages under /connect/*",
            ],
          ]}
        />
      ),
    },
    {
      id: "connect-gating",
      title: "/connect access control",
      content: (
        <>
          <DocP>
            <DocCode>/connect</DocCode> and all <DocCode>/connect/*</DocCode>{" "}
            routes require a valid signed 24-hour marketing session cookie (
            <DocCode>tv_ms</DocCode>). Direct visits to{" "}
            <DocCode>/connect</DocCode> redirect to the decoy homepage.
          </DocP>
          <DocTable
            headers={["Visitor action", "Result"]}
            rows={[
              ["Opens mytrustvisa.cards", "Decoy (Travixa)"],
              ["Types /connect manually", "Redirected to / (decoy)"],
              ["/connect?utm_source=instagram (no session)", "Redirected to /"],
              ["/?utm_source=instagram (no fbclid)", "Decoy — UTMs do not grant access"],
              [
                "Meta ad click → /?fbclid=...",
                "Verify → one-time token → /connect (24h session)",
              ],
              [
                "Google ad click → /?gclid=...",
                "Server-side gclid verify via Google Ads API → /connect",
              ],
              ["Valid session + logo click → /", "Auto-redirect back to /connect"],
            ]}
          />
        </>
      ),
    },
    {
      id: "verification-flow",
      title: "Server verification flow",
      content: (
        <DocFlow
          steps={[
            "User lands on / with click ID (fbclid, gclid, etc.) — never grant access from UTMs alone.",
            "Middleware sets homepage attestation cookie (tv_mh) and redirects to /api/marketing/verify.",
            "Platform adapter verifies click (Meta: format + homepage attestation; Google: click_view API).",
            "On success: 90s signed one-time token issued, bound to IP + User-Agent.",
            "/api/marketing/exchange exchanges token for 24h tv_ms session cookie.",
            "User redirected to /connect. Replay blocked via spent jti cookie (tv_ma_spent).",
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
            [
              "Meta / Instagram",
              "fbclid",
              "Format validation on / only",
              "No official inbound fbclid verify API — attribution-based, not cryptographic",
            ],
            [
              "Google",
              "gclid",
              "Google Ads API click_view",
              "Requires GOOGLE_ADS_* env vars on tmc-wallet-app",
            ],
            ["Google iOS", "gbraid / wbraid", "Fail closed", "No server-side verify documented"],
            ["TikTok", "ttclid", "Fail closed", "No inbound verify API"],
            ["LinkedIn", "li_fat_id", "Fail closed", "No inbound verify API"],
          ]}
        />
      ),
    },
    {
      id: "meta-ads",
      title: "Meta / Instagram ads",
      content: (
        <>
          <DocTable
            headers={["Setting", "Value"]}
            rows={[
              ["Ad destination URL", "https://mytrustvisa.cards/"],
              ["Do NOT use", "https://mytrustvisa.cards/connect"],
              ["Meta Pixel ID", "1682517452850789 (loads on /connect only, in code)"],
              ["Unlock mechanism", "fbclid auto-appended by Meta on ad clicks"],
            ]}
          />
          <DocP>
            UTMs (utm_source, utm_medium, utm_campaign) are for reporting only.
            Example ad URL:{" "}
            <DocCode>
              https://mytrustvisa.cards/?utm_source=instagram&utm_medium=paid
            </DocCode>
          </DocP>
        </>
      ),
    },
    {
      id: "render-env",
      title: "Render env vars (tmc-wallet-app)",
      content: (
        <DocPre>{`# Required
NEXT_PUBLIC_APP_URL=https://mytrustvisa.cards
BACKEND_API_URL=https://api.mytrustvisa.cards
NEXT_PUBLIC_PROJECT_ID=<walletconnect project id>
MARKETING_SESSION_SECRET=<auto-generated or openssl rand -hex 32>

# Developer test only (Render dashboard — never commit)
MARKETING_TEST_SECRET=tvmt_<openssl rand -hex 32>

# Google Ads only (skip for Meta-only campaigns)
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=  # optional MCC`}</DocPre>
      ),
    },
    {
      id: "backend-env",
      title: "Render env vars (tmc-backend)",
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
          Allowed origin must include{" "}
          <DocCode>https://mytrustvisa.cards</DocCode>. Wallet connect fails
          on the new domain until this is updated. Redeploy wallet app after
          changing <DocCode>NEXT_PUBLIC_APP_URL</DocCode> (baked at build time).
        </DocP>
      ),
    },
    {
      id: "developer-test",
      title: "Developer production test",
      content: (
        <>
          <DocP>
            Separate from ad verification. Set{" "}
            <DocCode>MARKETING_TEST_SECRET</DocCode> on Render only. Open in
            browser (incognito), never link from UI:
          </DocP>
          <DocPre>{`https://mytrustvisa.cards/api/marketing-test?token=<MARKETING_TEST_SECRET>`}</DocPre>
          <DocP>
            Valid secret → same 24h <DocCode>tv_ms</DocCode> session as ad
            visitors → redirects to /connect. Invalid/missing → 404. Rate-limited
            (10 attempts / 15 min / IP). Excluded from search indexing (see below).
          </DocP>
        </>
      ),
    },
    {
      id: "search-exclusion",
      title: "Search engine exclusion",
      content: (
        <>
          <DocP>
            Gated product and marketing API routes are excluded from indexing at
            three layers. The public decoy homepage (<DocCode>/</DocCode>) remains
            indexable.
          </DocP>
          <DocTable
            headers={["Layer", "Mechanism", "Paths"]}
            rows={[
              [
                "robots.txt",
                "Disallow rules in src/app/robots.ts",
                "/connect, /api/marketing-test, /api/marketing/",
              ],
              [
                "HTML metadata",
                "robots: noindex in connect/layout.tsx",
                "/connect/* pages",
              ],
              [
                "Response headers",
                "X-Robots-Tag: noindex, nofollow (middleware + API routes)",
                "/connect, /connect/*, /api/marketing/*, /api/marketing-test",
              ],
            ]}
          />
        </>
      ),
    },
    {
      id: "key-files",
      title: "Key implementation files",
      content: (
        <DocTable
          headers={["File", "Role"]}
          rows={[
            [
              "frontend/website/middleware.ts",
              "Route gating, click-ID detection, X-Robots-Tag on gated paths",
            ],
            [
              "frontend/website/src/app/robots.ts",
              "robots.txt disallow rules",
            ],
            [
              "frontend/website/src/app/connect/layout.tsx",
              "HTML robots metadata (noindex) for /connect/*",
            ],
            [
              "frontend/website/src/lib/marketing/http.ts",
              "withNoIndex helper (X-Robots-Tag)",
            ],
            [
              "frontend/website/src/lib/marketing/session.ts",
              "24h signed session (tv_ms)",
            ],
            [
              "frontend/website/src/lib/marketing/authorization-token.ts",
              "90s one-time exchange token",
            ],
            [
              "frontend/website/src/lib/marketing/homepage-attestation.ts",
              "Meta homepage-only fbclid gate (tv_mh)",
            ],
            [
              "frontend/website/src/lib/marketing/adapters/*.ts",
              "Per-platform verification",
            ],
            [
              "frontend/website/src/app/api/marketing/verify/route.ts",
              "Server verification entry",
            ],
            [
              "frontend/website/src/app/api/marketing/exchange/route.ts",
              "Token → session exchange",
            ],
            [
              "frontend/website/src/app/api/marketing-test/route.ts",
              "Developer-only test bypass",
            ],
            [
              "frontend/website/src/components/ConnectMetaPixel.tsx",
              "Meta Pixel on /connect only",
            ],
          ]}
        />
      ),
    },
    {
      id: "smoke-tests",
      title: "Post-deploy smoke tests",
      content: (
        <DocPre>{`# Terminal
curl -sI https://mytrustvisa.cards/ | head -3
curl -sI https://mytrustvisa.cards/connect | head -3
curl -s https://mytrustvisa.cards/robots.txt | grep -E 'connect|marketing'
curl -sI https://mytrustvisa.cards/connect | grep -i x-robots-tag
curl -s https://api.mytrustvisa.cards/v1/api/settings/public | head

# Browser (incognito)
# 1. /connect → should redirect to / (decoy)
# 2. /api/marketing-test?token=SECRET → /connect
# 3. /?fbclid=IwAR0123456789abcdefghijklmnopqrstuvwxyz → /connect
# 4. WalletConnect modal on /connect — no origin error`}</DocPre>
      ),
    },
  ],
};
