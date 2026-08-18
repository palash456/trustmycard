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
            <strong>Current production (micro VPS):</strong> mytrustvisa.cards
            on a 512 MB DigitalOcean droplet with Caddy TLS. Alternative budget
            path uses Render + Neon + Upstash.
          </DocP>
          <DocTable
            headers={["Service", "Provider", "URL"]}
            rows={[
              [
                "Wallet app",
                "Docker (VPS)",
                "mytrustvisa.cards (Caddy → :3000)",
              ],
              ["API", "Docker (VPS)", "api.mytrustvisa.cards (Caddy → :4000)"],
              ["TLS", "Caddy (Let's Encrypt)", "Ports 80/443 on VPS"],
              ["Workers", "Combined in backend", "No public HTTP"],
              ["Admin", "Local only", "localhost:3002"],
              ["PostgreSQL", "Neon", "DATABASE_URL"],
              ["Redis", "Upstash", "REDIS_URL"],
              [
                "Marketing (optional)",
                "Hostinger static",
                "www.mytrustvisa.cards",
              ],
              ["DNS", "Hostinger", "A records → VPS IP"],
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
          <DocFlow
            steps={[
              "512 MB DigitalOcean VPS with Docker + 1 GB swap.",
              "Images built locally, streamed via docker save | ssh docker load.",
              "Containers: backend + wallet + Caddy (TLS).",
              "External Neon Postgres + Upstash Redis.",
              "Admin runs locally against api.mytrustvisa.cards.",
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
      title: "mytrustvisa.cards layout",
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
            for URL map, Meta ads, and env vars. See{" "}
            <DocLink href="/documentation/domain-migration">
              Domain Migration
            </DocLink>{" "}
            for the generic checklist.
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
