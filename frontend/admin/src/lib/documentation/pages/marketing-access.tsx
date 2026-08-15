import {
  DocCallout,
  DocCode,
  DocLink,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

const ARCHIVE_URL =
  "https://github.com/palash456/trustmycard-marketing-gate-archive";

export const marketingAccessPage: DocPage = {
  slug: "marketing-access",
  title: "Public Site & Domain",
  description:
    "mytrustvisa.cards — URL map, Meta ads, env vars, DNS, TLS, and troubleshooting.",
  keywords: [
    "marketing",
    "mytrustvisa",
    "trustvisa",
    "domain",
    "security",
    "hostinger",
    "caddy",
    "meta",
    "instagram",
    "fbclid",
    "pixel",
    "dns",
    "api",
    "vps",
  ],
  sections: [
    {
      id: "current-model",
      title: "Current access model (2026)",
      content: (
        <>
          <DocP>
            The Trust Card product is <strong>public at</strong>{" "}
            <DocCode>/</DocCode>. There is no decoy cover page and no
            marketing-session gate. Legacy <DocCode>/connect</DocCode> URLs
            redirect to <DocCode>/</DocCode>.
          </DocP>
          <DocCallout variant="tip">
            Master repo guide:{" "}
            <DocCode>docs/infrastructure/mytrustvisa-domain-security.md</DocCode>
            . Media buyers:{" "}
            <DocCode>docs/marketing/meta-ads-setup-guide.md</DocCode>.
          </DocCallout>
        </>
      ),
    },
    {
      id: "production-url-map",
      title: "Production URL map",
      content: (
        <DocTable
          headers={["URL", "What"]}
          rows={[
            ["https://mytrustvisa.cards/", "Trust Card homepage + WalletConnect"],
            [
              "https://mytrustvisa.cards/frequentlyaskedquestions",
              "FAQ",
            ],
            ["https://mytrustvisa.cards/privacypolicy", "Privacy policy"],
            ["https://mytrustvisa.cards/termsandconditions", "Terms"],
            [
              "https://mytrustvisa.cards/connect",
              "Removed — returns 404",
            ],
            ["https://api.mytrustvisa.cards", "Nest API"],
            [
              "https://www.mytrustvisa.cards",
              "Optional static marketing (Hostinger)",
            ],
          ]}
        />
      ),
    },
    {
      id: "meta-ads",
      title: "Meta / Instagram ads",
      content: (
        <>
          <DocP>
            <strong>Ad destination:</strong>{" "}
            <DocCode>https://mytrustvisa.cards/</DocCode> — never{" "}
            <DocCode>/connect</DocCode>.
          </DocP>
          <DocP>
            Meta Pixel ID <DocCode>2158981564683913</DocCode> is installed in
            the wallet app root layout. Do not paste a second copy on Hostinger
            or in ad dashboards.
          </DocP>
        </>
      ),
    },
    {
      id: "env-vars",
      title: "Environment variables",
      content: (
        <>
          <DocPre>{`# website.env (wallet app)
NEXT_PUBLIC_APP_URL=https://mytrustvisa.cards
BACKEND_API_URL=https://api.mytrustvisa.cards
NEXT_PUBLIC_PROJECT_ID=<walletconnect>
NEXT_PUBLIC_MARKETING_URL=https://www.mytrustvisa.cards   # optional

# backend-budget.env
APP_ORIGIN=https://mytrustvisa.cards
ADMIN_ORIGIN=http://localhost:3002   # admin local on micro/budget
DATABASE_URL=<Neon>
REDIS_URL=<Upstash>`}</DocPre>
          <DocP>
            <DocCode>NEXT_PUBLIC_*</DocCode> are baked at build time — redeploy
            after changes. Removed legacy vars:{" "}
            <DocCode>MARKETING_SESSION_*</DocCode>,{" "}
            <DocCode>MARKETING_TEST_SECRET</DocCode>,{" "}
            <DocCode>GOOGLE_ADS_*</DocCode>.
          </DocP>
        </>
      ),
    },
    {
      id: "dns-tls",
      title: "DNS & TLS (micro VPS)",
      content: (
        <>
          <DocP>
            Production runs on a 512 MB DigitalOcean VPS with Caddy for
            automatic Let&apos;s Encrypt TLS. DNS at Hostinger:
          </DocP>
          <DocTable
            headers={["Record", "Points to"]}
            rows={[
              ["mytrustvisa.cards (A)", "VPS IP → Caddy → wallet:3000"],
              ["api.mytrustvisa.cards (A)", "VPS IP → Caddy → backend:4000"],
            ]}
          />
          <DocP>
            Deploy: <DocCode>./deploy.sh production --provider=docker-vps</DocCode>
            . See <DocLink href="/documentation/deployment">Deployment</DocLink>{" "}
            and <DocCode>deploy/README.md</DocCode>.
          </DocP>
        </>
      ),
    },
    {
      id: "smoke-tests",
      title: "Smoke tests",
      content: (
        <DocPre>{`curl -s https://api.mytrustvisa.cards/v1/api/settings/public
curl -s https://mytrustvisa.cards/api/settings/public
curl -sI http://mytrustvisa.cards/                    # HTTP → HTTPS
curl -sI https://mytrustvisa.cards/connect          # → /`}</DocPre>
      ),
    },
    {
      id: "historical",
      title: "Historical: decoy + /connect gate",
      content: (
        <>
          <DocP>
            The decoy homepage and marketing-session gate at{" "}
            <DocCode>/connect</DocCode> were removed from this repo in 2026.
            Private archive (restore reference only):
          </DocP>
          <DocP>
            <DocCode>{ARCHIVE_URL}</DocCode>
          </DocP>
          <DocP>
            Old doc: <DocCode>docs/infrastructure/marketing-access.md</DocCode>{" "}
            (deprecated).
          </DocP>
        </>
      ),
    },
  ],
};
