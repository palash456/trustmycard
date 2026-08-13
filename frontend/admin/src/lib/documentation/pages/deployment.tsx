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
            <strong>Budget deploy (current):</strong> mytrustvisa.cards on Render.
            Legacy trustmycard.com / trustvisa.cards layouts documented below.
          </DocP>
          <DocTable
            headers={["Service", "Provider", "URL"]}
            rows={[
              ["Wallet app", "Render Web Service", "mytrustvisa.cards"],
              ["API", "Render Web Service", "api.mytrustvisa.cards"],
              ["Workers", "Render (SERVICE_ROLE=all)", "No public HTTP"],
              ["Admin", "Local only (budget)", "localhost:3002"],
              [
                "PostgreSQL",
                "Neon free tier",
                "Connection via DATABASE_URL",
              ],
              ["Redis", "Upstash free tier", "Connection via REDIS_URL"],
              [
                "DNS",
                "Hostinger",
                "Apex + api CNAME → Render (not Hostinger website)",
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
      id: "trustvisa-domain",
      title: "mytrustvisa.cards layout",
      content: (
        <>
          <DocP>
            Apex domain on Render <DocCode>tmc-wallet-app</DocCode>: decoy
            Travixa cover at <DocCode>/</DocCode>, gated product connect at{" "}
            <DocCode>/connect</DocCode>. Marketing ad traffic (Meta{" "}
            <DocCode>fbclid</DocCode>) lands on <DocCode>/</DocCode> and is
            redirected to <DocCode>/connect</DocCode> after server verification.
            Manual <DocCode>/connect</DocCode> visits are blocked.
          </DocP>
          <DocP>
            See{" "}
            <DocLink href="/documentation/marketing-access">
              Marketing & Domains
            </DocLink>{" "}
            for gating rules, Meta ads, and env vars. See{" "}
            <DocLink href="/documentation/domain-migration">
              Domain Migration
            </DocLink>{" "}
            for the generic domain migration checklist. Repo:{" "}
            <DocCode>docs/infrastructure/domain-migration.md</DocCode>
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
