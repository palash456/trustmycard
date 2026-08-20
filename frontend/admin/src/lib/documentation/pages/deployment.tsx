import {
  DocCode,
  DocFlow,
  DocLink,
  DocP,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const deploymentPage: DocPage = {
  slug: "deployment",
  title: "Deployment & Infrastructure",
  description:
    "Production topology, Render deployment, DNS, and disaster recovery.",
  keywords: [
    "render",
    "deploy",
    "hostinger",
    "cloudflare",
    "vps",
    "flokinet",
    "digitalocean",
    "hetzner",
    "docker-vps",
    "neon",
    "upstash",
    "production",
    "mytrustvisa",
    "trustvisa",
  ],
  sections: [
    {
      id: "production-topology",
      title: "Production topology",
      content: (
        <>
          <DocP>
            <strong>Current production (micro VPS):</strong> exampleUrl.com
            on a 512 MB DigitalOcean droplet with Caddy TLS. Alternative budget
            path uses Render + Neon + Upstash.
          </DocP>
          <DocTable
            headers={["Service", "Provider", "URL"]}
            rows={[
              [
                "Wallet app",
                "Docker (VPS)",
                "exampleUrl.com (Caddy → :3000)",
              ],
              ["API", "Docker (VPS)", "api.exampleUrl.com (Caddy → :4000)"],
              ["TLS", "Caddy (Let's Encrypt)", "Ports 80/443 on VPS"],
              ["Workers", "Combined in backend", "No public HTTP"],
              ["Admin", "Vercel (or local dev)", "Production API at api.exampleUrl.com"],
              ["PostgreSQL", "Neon", "DATABASE_URL"],
              ["Redis", "Upstash", "REDIS_URL"],
              [
                "Marketing (optional)",
                "Hostinger static",
                "www.exampleUrl.com",
              ],
              [
                "DNS",
                "Cloudflare (recommended)",
                "A records → VPS IP; optional orange-cloud proxy + WAF",
              ],
            ]}
          />
          <DocTable
            headers={["Service", "Provider", "URL (legacy full deploy)"]}
            rows={[
              ["Marketing", "Hostinger static", "trustmycard.com"],
              ["Wallet app", "Render Web Service", "app.trustmycard.com"],
              ["API", "Render Web Service", "api.trustmycard.com"],
              ["Admin", "Render Web Service", "admin.trustmycard.com"],
            ]}
          />
        </>
      ),
    },
    {
      id: "render-blueprint",
      title: "Render blueprint",
      content: (
        <DocP>
          <DocCode>render.yaml</DocCode> at repo root defines services. Budget
          variant: <DocCode>render-budget.yaml</DocCode> (~$14/mo with Neon +
          Upstash). Full deploy guide covers split API/worker services with
          separate env overlays via <DocCode>SERVICE_ROLE</DocCode>.
        </DocP>
      ),
    },
    {
      id: "budget-deploy",
      title: "Budget deploy (~$14/mo)",
      content: (
        <DocFlow
          steps={[
            "2× Render Starter web services (combined backend SERVICE_ROLE=all + frontend).",
            "Neon PostgreSQL free tier.",
            "Upstash Redis free tier.",
            "Hostinger for marketing static site.",
            "All-in-one backend acceptable for low-volume launch.",
          ]}
        />
      ),
    },
    {
      id: "full-deploy",
      title: "Full deploy (~$60/mo)",
      content: (
        <DocP>
          Separate API (<DocCode>SERVICE_ROLE=api</DocCode>) and worker (
          <DocCode>SERVICE_ROLE=worker</DocCode>) services. Dedicated Postgres
          and Redis. Cloudflare edge optional for WAF/SSO. Signing keys only on
          worker service env.
        </DocP>
      ),
    },
    {
      id: "micro-vps",
      title: "Micro VPS deploy (current production)",
      content: (
        <>
          <DocP>
            Deploy commands:{" "}
            <DocLink href="/documentation/commands">Command Reference</DocLink>.
            Moving VPS provider or droplet:{" "}
            <DocLink href="/documentation/vps-migration">VPS Migration</DocLink>.
          </DocP>
          <DocFlow
            steps={[
              "512 MB DigitalOcean VPS with Docker + 1 GB swap.",
              "Images built locally, streamed via docker save | ssh docker load.",
              "Containers: backend + wallet + Caddy (TLS).",
              "External Neon Postgres + Upstash Redis.",
              "Admin runs on Vercel (or locally for dev) against api.exampleUrl.com.",
              "Deploy: ./deploy.sh production --provider=docker-vps",
            ]}
          />
          <DocP>
            Caddy config: <DocCode>deploy/caddy/Caddyfile</DocCode>. Compose
            edge:{" "}
            <DocCode>deploy/compose/docker-compose.micro-edge.yml</DocCode>. See{" "}
            <DocCode>deploy/README.md</DocCode>.
          </DocP>
        </>
      ),
    },
    {
      id: "trustvisa-domain",
      title: "exampleUrl.com layout",
      content: (
        <>
          <DocP>
            Apex domain serves the Trust Card product at <DocCode>/</DocCode>.
            Legal pages at <DocCode>/frequentlyaskedquestions</DocCode>,{" "}
            <DocCode>/privacypolicy</DocCode>,{" "}
            <DocCode>/termsandconditions</DocCode>. Legacy{" "}
            <DocCode>/connect</DocCode> redirects to <DocCode>/</DocCode>.
          </DocP>
          <DocP>
            See{" "}
            <DocLink href="/documentation/marketing-access">
              Public Site & Domain
            </DocLink>{" "}
            for URL map, Meta ads, and env vars.             See{" "}
            <DocLink href="/documentation/domain-migration">
              Domain Migration
            </DocLink>{" "}
            for hostname changes and{" "}
            <DocLink href="/documentation/vps-migration">
              VPS Migration
            </DocLink>{" "}
            for hosting provider / droplet moves.
          </DocP>
        </>
      ),
    },
    {
      id: "cloudflare",
      title: "Cloudflare DNS & proxy",
      content: (
        <>
          <DocP>
            <strong>Recommended production DNS:</strong> Cloudflare nameservers
            at the registrar, A records for <DocCode>@</DocCode>,{" "}
            <DocCode>api</DocCode>, and <DocCode>www</DocCode> → VPS public IP.
            Do not use Hostinger shared hosting as the apex origin — it conflicts
            with the wallet app on the VPS.
          </DocP>
          <DocFlow
            steps={[
              "Add site at dash.cloudflare.com; point registrar NS to Cloudflare.",
              "Grey-cloud (DNS-only) first: verify Caddy Let's Encrypt on apex + api.",
              "Optional orange-cloud: enable proxy + SSL/TLS Full (strict) for WAF/DDoS.",
              "Caddy template includes trusted_proxies cloudflare — redeploy after enabling proxy.",
              "Smoke: curl https://<domain>/ and https://api.<domain>/v1/api/settings/public",
            ]}
          />
          <DocP>
            Full step-by-step:{" "}
            <DocCode>docs/infrastructure/cloudflare-setup.md</DocCode>. Abuse
            resilience:{" "}
            <DocCode>docs/infrastructure/hosting-abuse-resilience.md</DocCode>.
          </DocP>
        </>
      ),
    },
    {
      id: "supported-vps-providers",
      title: "Supported VPS providers",
      content: (
        <>
          <DocP>
            Any Ubuntu/Debian VPS with SSH, 512 MB+ RAM, and ports 80/443 open
            works with <DocCode>--provider=docker-vps</DocCode>. Tested / documented
            examples:
          </DocP>
          <DocTable
            headers={["Provider", "Notes"]}
            rows={[
              [
                "DigitalOcean",
                "Current reference micro topology (~512 MB droplet)",
              ],
              ["Hetzner", "Common cost-optimized alternative"],
              ["Hostinger VPS", "VPS product only — not shared web hosting"],
              [
                "FlokiNet",
                "Same deploy flow; update deploy/provider.credentials.env only",
              ],
            ]}
          />
          <DocP>
            Provider swap guide:{" "}
            <DocLink href="/documentation/vps-migration">VPS Migration</DocLink>
            . Credentials: <DocCode>deploy/provider.credentials.env</DocCode> (
            <DocCode>VPS_HOST</DocCode>, <DocCode>VPS_USER</DocCode>,{" "}
            <DocCode>VPS_SSH_KEY</DocCode>).
          </DocP>
        </>
      ),
    },
    {
      id: "post-deploy-config",
      title: "Post-deploy configuration",
      content: (
        <>
          <DocP>
            After <DocCode>./deploy.sh production --provider=docker-vps</DocCode>,
            confirm runtime config — not only containers:
          </DocP>
          <DocTable
            headers={["Change", "Where", "Action"]}
            rows={[
              [
                "Domain / Meta Pixel",
                "deploy/runtime-config/production.json + npm run config:sync-vps",
                "config-update.sh or admin production-config when enabled",
              ],
              [
                "Eligibility mins (NEXT_PUBLIC_*_MIN_*_BALANCE)",
                "config/platform.env + env/vault/config/platform.env",
                "Set values; full deploy (NEXT_PUBLIC baked at build)",
              ],
              [
                "WalletConnect / public URLs",
                "env/profiles/production/website.env",
                "Rebuild wallet image; redeploy",
              ],
              [
                "Locale / tab title copy",
                "frontend/website/locales/*.json",
                "Rebuild wallet; see docs/operations/i18n-locale-sync.md",
              ],
              [
                "Spender / collector keys",
                "config/platform.env",
                "Redeploy backend; see Spender Rotation doc",
              ],
            ]}
          />
          <DocP>
            <DocCode>--skip-images</DocCode> redeploy applies compiled env +
            Caddy only — insufficient when <DocCode>NEXT_PUBLIC_*</DocCode>{" "}
            changed. See{" "}
            <DocLink href="/documentation/configuration">
              Configuration & Environment
            </DocLink>
            .
          </DocP>
        </>
      ),
    },
    {
      id: "secrets",
      title: "Secrets management",
      content: (
        <DocP>
          Per-service env var matrix documented in secrets guide. Doppler
          recommended for production secret rotation. Never commit{" "}
          <DocCode>platform.env</DocCode> with real keys. Worker service gets
          signing keys; API and frontend services do not.
        </DocP>
      ),
    },
    {
      id: "disaster-recovery",
      title: "Disaster recovery",
      content: (
        <DocTable
          headers={["Component", "RPO", "Recovery"]}
          rows={[
            [
              "PostgreSQL",
              "Point-in-time backup dependent",
              "Restore from Neon/Render backup",
            ],
            [
              "Redis",
              "Ephemeral queue state",
              "Reprocess from OutboxEvent / poll scheduler",
            ],
            ["Render services", "Git-deployed", "Redeploy from main branch"],
          ]}
        />
      ),
    },
    {
      id: "cron",
      title: "Scheduled processes",
      content: (
        <DocP>
          No external cron service — all scheduled work runs as NestJS
          schedulers inside worker process: ApprovalCollectionScheduler,
          NativeTransferReconciliationScheduler, CollectionRecoveryScheduler,
          OutboxPublisherService interval.
        </DocP>
      ),
    },
  ],
};
