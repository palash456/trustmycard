import {
  DocCallout,
  DocCode,
  DocFlow,
  DocLink,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import { DomainMigrationTestSuite } from "@/components/documentation/DomainMigrationTestSuite";
import type { DocPage } from "../types";

export const domainMigrationPage: DocPage = {
  slug: "domain-migration",
  title: "Domain Migration",
  description:
    "Production domain migration — WEBSITE_DOMAIN runtime config, DNS (Hostinger, Namecheap, Cloudflare, and more), Caddy TLS, WalletConnect, and automated verification.",
  keywords: [
    "domain",
    "migration",
    "website_domain",
    "runtime-config",
    "hostinger",
    "namecheap",
    "cloudflare",
    "godaddy",
    "route53",
    "squarespace",
    "digitalocean",
    "caddy",
    "dns",
    "a record",
    "cname",
    "ssl",
    "walletconnect",
    "vercel",
    "test",
    "verification",
    "old domain",
    "new domain",
    "config-update",
  ],
  sections: [
    {
      id: "overview",
      title: "What you are changing",
      content: (
        <>
          <DocP>
            Move production from your <strong>old apex domain</strong> (e.g.{" "}
            <DocCode>old-domain.example</DocCode>) to your{" "}
            <strong>new apex domain</strong> (e.g.{" "}
            <DocCode>new-domain.example</DocCode>). The wallet product stays at{" "}
            <DocCode>/</DocCode> on the apex; the API lives on{" "}
            <DocCode>api.&lt;domain&gt;</DocCode>.
          </DocP>
          <DocTable
            headers={["Role", "Old", "New (derived from WEBSITE_DOMAIN)"]}
            rows={[
              [
                "Wallet app (product)",
                "https://old-domain.example",
                "https://new-domain.example",
              ],
              [
                "API",
                "https://api.old-domain.example",
                "https://api.new-domain.example",
              ],
              [
                "Optional marketing / www",
                "https://www.old-domain.example",
                "https://www.new-domain.example",
              ],
            ]}
          />
          <DocP>
            <strong>Current production topology (micro VPS):</strong> Docker
            wallet + API behind <DocCode>Caddy</DocCode> on a small VPS (e.g.
            DigitalOcean). DNS at your registrar points apex and{" "}
            <DocCode>api</DocCode> to the VPS IP. TLS is automatic via
            Let&apos;s Encrypt. Admin runs on{" "}
            <DocLink href="/documentation/commands">Vercel or locally</DocLink>{" "}
            — not on a public <DocCode>admin.</DocCode> subdomain.
          </DocP>
          <DocCallout variant="tip">
            <DocCode>WEBSITE_DOMAIN</DocCode> is the single source of truth.
            Public URLs (<DocCode>https://api.&lt;domain&gt;</DocCode>, wallet
            origin, Caddy hosts) are compiled from it — you do not hand-edit{" "}
            <DocCode>BACKEND_API_URL</DocCode> or{" "}
            <DocCode>PRODUCTION_BACKEND_API_URL</DocCode> in production profile
            env files. Live value:{" "}
            <DocCode>deploy/runtime-config/production.json</DocCode> (VPS:{" "}
            <DocCode>/opt/tmc/deploy/runtime-config/</DocCode>). Example
            production apex today: <DocCode>mytrustvisa.cards</DocCode>.
          </DocCallout>
          <DocP>
            Legal pages remain at root paths (
            <DocCode>/frequentlyaskedquestions</DocCode>, etc.). Legacy{" "}
            <DocCode>/connect</DocCode> is removed (expect 404 on the new
            domain). See{" "}
            <DocLink href="/documentation/marketing-access">
              Public Site & Domain
            </DocLink>{" "}
            for URL map and Meta ads.
          </DocP>
        </>
      ),
    },
    {
      id: "prerequisites",
      title: "Before you start",
      content: (
        <DocFlow
          steps={[
            "New domain registered and in your DNS registrar account.",
            "VPS IP address ready (same server or new droplet after provision).",
            "SSH access to the VPS and operator machine with this repo + deploy credentials.",
            "WalletConnect Cloud project access.",
            "Ads/marketing contact ready to update destination URL after go-live.",
            "Backup runtime state: deploy/runtime-config/production.json (and VPS copy).",
            "Do NOT point apex @ to shared-hosting website builders — wallet app serves the apex.",
          ]}
        />
      ),
    },
    {
      id: "runtime-config",
      title: "Step 1 — Update WEBSITE_DOMAIN (runtime config)",
      content: (
        <>
          <DocP>
            After DNS is ready (Step 2), commit the new domain to runtime state.
            This drives Caddy, wallet env, and API <DocCode>APP_ORIGIN</DocCode>{" "}
            on the next config-only release.
          </DocP>
          <DocPre title="Operator machine (recommended)">{`# Check current state
npm run config:status

# Apply new apex domain (hostname only — no https://)
./scripts/config-update.sh domain new-domain.example --actor "you@machine"

# Optional: sync state to VPS before/after deploy
npm run config:sync-vps

# Config-only release (restarts caddy, backend, wallet — no image rebuild)
./deploy.sh production --provider=docker-vps --release=config`}</DocPre>
          <DocP>
            <strong>Admin portal (Production data source):</strong>{" "}
            <DocLink href="/settings/production-config">
              Settings → Production Configuration
            </DocLink>{" "}
            can deploy domain changes when the API host has{" "}
            <DocCode>ADMIN_PRODUCTION_CONFIG_ENABLED=true</DocCode> and{" "}
            <DocCode>TMC_REPO_ROOT</DocCode>. On micro VPS (API in Docker),
            prefer the CLI from your operator machine; local admin in{" "}
            <strong>Development</strong> data source shows a demo preview only.
          </DocP>
          <DocCallout variant="warning">
            Keep empty placeholders for <DocCode>WEBSITE_DOMAIN</DocCode> and{" "}
            <DocCode>META_PIXEL_ID</DocCode> in{" "}
            <DocCode>config/platform.env</DocCode> after init — non-empty values
            block runtime updates. See{" "}
            <DocLink href="/documentation/commands">Command Reference</DocLink>{" "}
            → Runtime configuration.
          </DocCallout>
        </>
      ),
    },
    {
      id: "dns-overview",
      title: "Step 2 — DNS records (all providers)",
      content: (
        <>
          <DocP>
            Point <strong>apex</strong> and <strong>api</strong> at your VPS.
            Caddy terminates TLS for both. Missing <DocCode>api</DocCode> DNS is
            the most common post-migration failure (wallet 502 / API unreachable).
          </DocP>
          <DocTable
            headers={["Type", "Name / Host", "Value", "TTL", "Notes"]}
            rows={[
              [
                "A",
                "@ (apex)",
                "YOUR_VPS_IP",
                "300–3600",
                "Wallet app — product at /",
              ],
              [
                "A",
                "api",
                "YOUR_VPS_IP",
                "300–3600",
                "Required — Nest API",
              ],
              [
                "CNAME",
                "www",
                "new-domain.example",
                "300–3600",
                "Optional static marketing on www",
              ],
            ]}
          />
          <DocCallout variant="warning">
            Remove registrar <strong>parking</strong>, shared-hosting{" "}
            <DocCode>@</DocCode> A records, and any apex{" "}
            <DocCode>public_html</DocCode> site that would steal traffic from
            the wallet container.
          </DocCallout>
          <DocP>
            Wait for propagation (often 15 min–2 hours; up to 48h). Verify:
          </DocP>
          <DocPre>{`dig +short new-domain.example A
dig +short api.new-domain.example A
# Both should return YOUR_VPS_IP`}</DocPre>
        </>
      ),
    },
    {
      id: "dns-hostinger",
      title: "DNS — Hostinger",
      content: (
        <>
          <DocFlow
            steps={[
              "hPanel → Domains → new-domain.example → DNS / DNS Zone.",
              "Delete parking or Website Builder A records on @ if present.",
              "Add A record: Name @ → YOUR_VPS_IP.",
              "Add A record: Name api → YOUR_VPS_IP.",
              "(Optional) CNAME: Name www → new-domain.example.",
              "Save. SSL on the VPS is handled by Caddy after DNS propagates.",
            ]}
          />
          <DocCallout variant="tip">
            Hostinger is DNS-only for this stack — do not enable their website
            hosting on the apex if Caddy serves the product.
          </DocCallout>
        </>
      ),
    },
    {
      id: "dns-namecheap",
      title: "DNS — Namecheap",
      content: (
        <>
          <DocFlow
            steps={[
              "Domain List → Manage → Advanced DNS.",
              "Remove URL Redirect or Parking Page records on @ and www.",
              "Add A Record: Host @ → YOUR_VPS_IP.",
              "Add A Record: Host api → YOUR_VPS_IP.",
              "(Optional) CNAME: Host www → new-domain.example.",
              "Save all changes.",
            ]}
          />
        </>
      ),
    },
    {
      id: "dns-cloudflare",
      title: "DNS — Cloudflare",
      content: (
        <>
          <DocP>
            Cloudflare can proxy (orange cloud) or DNS-only (grey cloud). Both
            work; orange cloud adds WAF/CDN — ensure SSL mode is{" "}
            <strong>Full (strict)</strong> and origin serves valid TLS (Caddy
            does). Caddy template includes{" "}
            <DocCode>trusted_proxies cloudflare</DocCode>.
          </DocP>
          <DocTable
            headers={["Type", "Name", "Content", "Proxy"]}
            rows={[
              ["A", "@", "YOUR_VPS_IP", "Proxied or DNS only"],
              ["A", "api", "YOUR_VPS_IP", "Proxied or DNS only"],
              ["CNAME", "www", "new-domain.example", "Optional"],
            ]}
          />
          <DocP>
            See{" "}
            <DocLink href="/documentation/deployment">
              Deployment & Infrastructure
            </DocLink>{" "}
            and <DocCode>docs/infrastructure/cloudflare-setup.md</DocCode> for
            edge hardening.
          </DocP>
        </>
      ),
    },
    {
      id: "dns-other-registrars",
      title: "DNS — GoDaddy, Squarespace, Route 53, and others",
      content: (
        <>
          <DocTable
            headers={["Provider", "Where to edit", "Notes"]}
            rows={[
              [
                "GoDaddy",
                "My Products → Domain → DNS → DNS Records",
                "Delete forwarding on @; add A for @ and api",
              ],
              [
                "Squarespace Domains",
                "Settings → Domains → DNS Settings",
                "Use A records; CNAME www → apex if needed",
              ],
              [
                "Google Domains / Squarespace",
                "Custom records → Manage custom records",
                "A @ and A api to VPS IP",
              ],
              [
                "AWS Route 53",
                "Hosted zone → Create record",
                "A alias or A for apex; A for api subdomain",
              ],
              [
                "Porkbun / Dynadot / Gandi",
                "DNS / Authoritative DNS",
                "Same A @ + A api pattern",
              ],
            ]}
          />
          <DocP>
            Every provider uses the same logical records — only the UI labels
            differ (<DocCode>@</DocCode> vs blank host vs root).
          </DocP>
        </>
      ),
    },
    {
      id: "walletconnect",
      title: "Step 3 — WalletConnect Cloud",
      content: (
        <DocP>
          WalletConnect Cloud → your project → <strong>Allowed origins</strong> →
          add <DocCode>https://new-domain.example</DocCode> (apex only, no
          trailing path). Remove <DocCode>https://old-domain.example</DocCode>{" "}
          after verification. Wallet connect fails on the new domain until this
          is saved. Keep <DocCode>NEXT_PUBLIC_PROJECT_ID</DocCode> unchanged.
        </DocP>
      ),
    },
    {
      id: "meta-ads",
      title: "Step 4 — Ads, Meta Pixel, and marketing URL",
      content: (
        <>
          <DocTable
            headers={["", "URL"]}
            rows={[
              ["Old ad destination", "https://old-domain.example/"],
              ["New ad destination", "https://new-domain.example/"],
            ]}
          />
          <DocP>
            Destination must be the <strong>homepage</strong> (
            <DocCode>/</DocCode>), not a legacy path. Update Meta Pixel via
            runtime config if it changes:
          </DocP>
          <DocPre>{`./scripts/config-update.sh pixel YOUR_PIXEL_ID --actor "you@machine"`}</DocPre>
        </>
      ),
    },
    {
      id: "local-admin",
      title: "Step 5 — Local admin & operators",
      content: (
        <>
          <DocP>
            Local admin resolves production API from{" "}
            <DocCode>WEBSITE_DOMAIN</DocCode> (runtime JSON hydrated at startup)
            — no <DocCode>PRODUCTION_BACKEND_API_URL</DocCode> in{" "}
            <DocCode>admin.env</DocCode>.
          </DocP>
          <DocPre title="env/profiles/development/admin.env">{`ADMIN_ALLOW_PRODUCTION_LOGS=true
PRODUCTION_ADMIN_API_KEY=<matches production ADMIN_API_KEY>`}</DocPre>
          <DocP>
            Switch account menu <strong>Data source → Production</strong> to hit
            live API after migration. Vercel admin uses{" "}
            <DocCode>BACKEND_API_URL=https://api.new-domain.example</DocCode> in
            project env.
          </DocP>
        </>
      ),
    },
    {
      id: "verification",
      title: "Step 6 — Verify",
      content: (
        <>
          <DocPre>{`curl -sI https://new-domain.example/ | head -3
curl -sI http://new-domain.example/ | head -3
curl -sI https://new-domain.example/connect | head -3
curl -s https://api.new-domain.example/v1/api/settings/public | head`}</DocPre>
          <DocTable
            headers={["Test (incognito)", "Expected"]}
            rows={[
              ["https://new-domain.example/", "Product homepage, valid HTTPS"],
              ["https://new-domain.example/connect", "HTTP 404 (path removed)"],
              [
                "https://new-domain.example/frequentlyaskedquestions",
                "FAQ loads (public)",
              ],
              [
                "/?fbclid=IwAR0123456789abcdefghijklmnopqrstuvwxyz",
                "Stays on / (public product, no session gate)",
              ],
              ["WalletConnect on /", "Modal works, no origin error"],
              ["http://new-domain.example/", "Redirects to HTTPS"],
              ["api.new-domain.example settings/public", "JSON response"],
            ]}
          />
          <DocCallout variant="tip">
            Run the full automated suite in Step 8 — enter old and new domains
            in the panel below.
          </DocCallout>
        </>
      ),
    },
    {
      id: "old-domain",
      title: "Step 7 — Old domain",
      content: (
        <DocTable
          headers={["Option", "Action"]}
          rows={[
            [
              "A — Redirect (recommended)",
              "301 apex + api old hostnames to new-domain.example (registrar redirect or Caddy on old DNS)",
            ],
            [
              "B — Let expire",
              "Update all ads/links; old domain stops when registration lapses",
            ],
            [
              "C — Run both temporarily",
              "Keep old DNS during cutover; ensure APP_ORIGIN / CORS allow only the new apex before ads switch",
            ],
          ]}
        />
      ),
    },
    {
      id: "render-alternative",
      title: "Alternative — Render + managed DB (legacy budget path)",
      content: (
        <>
          <DocP>
            If you host on <strong>Render</strong> instead of the micro VPS,
            add custom domains on each service and set env vars manually (not
            runtime config):
          </DocP>
          <DocTable
            headers={["Service", "Custom domain"]}
            rows={[
              ["tmc-wallet-app", "new-domain.example, www.new-domain.example"],
              ["tmc-backend", "api.new-domain.example"],
            ]}
          />
          <DocTable
            headers={["Variable", "Value"]}
            rows={[
              ["NEXT_PUBLIC_APP_URL", "https://new-domain.example"],
              ["BACKEND_API_URL", "https://api.new-domain.example"],
              ["APP_ORIGIN", "https://new-domain.example"],
            ]}
          />
          <DocP>
            Use registrar CNAME targets Render provides instead of A records to
            VPS. Rebuild wallet after <DocCode>NEXT_PUBLIC_*</DocCode> changes.
            See{" "}
            <DocLink href="/documentation/deployment">
              Deployment & Infrastructure
            </DocLink>.
          </DocP>
        </>
      ),
    },
    {
      id: "order-of-operations",
      title: "Recommended order",
      content: (
        <DocFlow
          steps={[
            "Backup deploy/runtime-config/production.json and VPS runtime dir.",
            "Add DNS: A records for @ and api → VPS IP (Steps 2 + provider section).",
            "Wait until dig + curl show new hostnames hitting the VPS.",
            "Run config-update.sh domain new-domain.example → config-only deploy.",
            "Update WalletConnect allowed origin.",
            "Run Step 8 migration test suite (old + new domains).",
            "Update ad destination URL to https://new-domain.example/.",
            "Retire or redirect old-domain.example.",
          ]}
        />
      ),
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting",
      content: (
        <DocTable
          headers={["Problem", "Fix"]}
          rows={[
            [
              "Registrar parking / wrong page",
              "Apex @ still points to shared hosting — set A → VPS IP",
            ],
            [
              "Wallet loads but API 502",
              "Missing api subdomain A record or Caddy not restarted after domain change",
            ],
            [
              "TLS / certificate errors",
              "Wait for DNS; confirm Caddy logs on VPS; Cloudflare → Full (strict)",
            ],
            [
              "WalletConnect origin error",
              "Add https://new-domain.example in WalletConnect Cloud",
            ],
            [
              "API CORS errors",
              "Redeploy config release so APP_ORIGIN matches new WEBSITE_DOMAIN",
            ],
            [
              "/connect still works on new domain",
              "Redeploy wallet image after config compile — expect 404",
            ],
            [
              "Admin Production toggle missing locally",
              "Set ADMIN_ALLOW_PRODUCTION_LOGS + PRODUCTION_ADMIN_API_KEY; ensure runtime production.json has WEBSITE_DOMAIN",
            ],
            [
              "config-update blocked",
              "Empty WEBSITE_DOMAIN and META_PIXEL_ID in config/platform.env",
            ],
            [
              "Ads still use old URL",
              "Update destination to https://new-domain.example/",
            ],
          ]}
        />
      ),
    },
    {
      id: "migration-test-suite",
      title: "Step 8 — Full migration test suite (required)",
      content: (
        <>
          <DocP>
            After DNS and runtime config are updated, use the suite below. Enter{" "}
            <strong>old domain</strong> and <strong>new domain</strong> (hostname
            only, e.g. <DocCode>trustvisa.cards</DocCode> and{" "}
            <DocCode>mytrustvisa.cards</DocCode>), then click{" "}
            <strong>Run automated tests</strong>. Also available under{" "}
            <DocLink href="/developer-test">Developer Test</DocLink> → Domain
            migration.
          </DocP>
          <DocP>
            Automated checks cover redirects, legal pages, API reachability, and
            CORS. Only <strong>B8</strong> (WalletConnect UI) and{" "}
            <strong>B11</strong> (TLS dashboard) need a quick manual confirm.
          </DocP>
          <DomainMigrationTestSuite />
          <DocCallout variant="tip" title="When migration is 100% complete">
            All automated checks pass, runtime state shows the new{" "}
            <DocCode>WEBSITE_DOMAIN</DocCode>, ads point to{" "}
            <DocCode>https://new-domain.example/</DocCode>, and the old domain
            is retired or redirected per Step 7.
          </DocCallout>
        </>
      ),
    },
    {
      id: "checklist",
      title: "Checklist summary",
      content: (
        <DocFlow
          steps={[
            "☐ DNS: A @ and A api → VPS IP (registrar / Cloudflare)",
            "☐ dig / curl confirm apex + api resolve correctly",
            "☐ config-update.sh domain new-domain.example applied",
            "☐ Config-only deploy completed (caddy + backend + wallet restarted)",
            "☐ runtime-config/production.json shows new WEBSITE_DOMAIN on VPS",
            "☐ WalletConnect origin updated",
            "☐ Step 8 — migration test suite: all automated checks pass",
            "☐ Ad destination URL updated to https://new-domain.example/",
            "☐ (Optional) Old domain redirected or allowed to expire",
          ]}
        />
      ),
    },
  ],
};
