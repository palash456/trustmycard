import {
  DocCode,
  DocFlow,
  DocP,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const deploymentPage: DocPage = {
  slug: "deployment",
  title: "Deployment & Infrastructure",
  description:
    "Production topology, Render deployment, DNS, and disaster recovery.",
  keywords: ["render", "deploy", "hostinger", "neon", "upstash", "production"],
  sections: [
    {
      id: "production-topology",
      title: "Production topology",
      content: (
        <DocTable
          headers={["Service", "Provider", "URL"]}
          rows={[
            ["Marketing", "Hostinger static", "trustmycard.com"],
            ["Wallet app", "Render Web Service", "app.trustmycard.com"],
            ["API", "Render Web Service", "api.trustmycard.com"],
            ["Workers", "Render Background Worker", "No public HTTP"],
            ["Admin", "Render Web Service", "admin.trustmycard.com"],
            [
              "PostgreSQL",
              "Neon or Render Postgres",
              "Connection via DATABASE_URL",
            ],
            ["Redis", "Upstash or Render Redis", "Connection via REDIS_URL"],
          ]}
        />
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
      title: "trustvisa.cards layout",
      content: (
        <DocP>
          Apex domain on Render: decoy Travixa cover at <DocCode>/</DocCode>,
          product connect at <DocCode>/connect</DocCode>. DNS configured per
          trustvisa-single-domain guide.
        </DocP>
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
