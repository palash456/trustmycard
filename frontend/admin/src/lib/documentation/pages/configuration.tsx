import {
  DocCode,
  DocFlow,
  DocLink,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const configurationPage: DocPage = {
  slug: "configuration",
  title: "Configuration & Environment",
  description:
    "TMC_ENV profiles, platform env vars, runtime settings, and config load chain.",
  keywords: ["env", "TMC_ENV", "platform.env", "SERVICE_ROLE", "config"],
  sections: [
    {
      id: "load-chain",
      title: "Config load chain",
      content: (
        <DocFlow
          steps={[
            "config/load-env.mjs selects TMC_ENV profile and loads layered .env files.",
            "platform-config.loader.ts reads platform env vars (sole reader).",
            "PlatformConfigService exposes typed facade.",
            "ConfigService merges env defaults with AppSettings DB overrides.",
            "Public settings exposed via GET /v1/api/settings/public to frontend.",
          ]}
        />
      ),
    },
    {
      id: "profiles",
      title: "TMC_ENV profiles",
      content: (
        <DocTable
          headers={["Profile", "Path", "Use"]}
          rows={[
            ["development", "env/profiles/development/", "Local dev"],
            ["production", "env/profiles/production/", "Live production"],
          ]}
        />
      ),
    },
    {
      id: "service-role",
      title: "SERVICE_ROLE",
      content: (
        <DocTable
          headers={["Value", "Process", "Signing"]}
          rows={[
            ["api", "HTTP API only", "COLLECTION_SIGNING_ENABLED=false"],
            [
              "worker",
              "BullMQ + schedulers",
              "COLLECTION_SIGNING_ENABLED=true",
            ],
            ["all", "Local monolith", "Both API and workers"],
          ]}
        />
      ),
    },
    {
      id: "infrastructure-vars",
      title: "Infrastructure (required in production)",
      content: (
        <DocPre>{`DATABASE_URL          PostgreSQL connection
REDIS_URL             BullMQ / Redis
TMC_ENV               development | production
PORT                  HTTP port (default 4000)
SERVICE_ROLE          api | worker | all
NODE_ENV              standard Node env`}</DocPre>
      ),
    },
    {
      id: "auth-vars",
      title: "Auth & security",
      content: (
        <DocPre>{`ADMIN_API_KEY           Admin API authentication
APP_ORIGIN              Wallet website CORS origin (https://mytrustvisa.cards)
ADMIN_ORIGIN            Admin panel CORS origin
WALLET_SESSION_TTL_MS        Wallet session TTL (default 30 min)
WALLET_PERSONAL_SIGN_ENABLED   true = personal_sign auth (default); false = tx-backed hybrid auth
THROTTLE_TTL_MS         Rate limit window
THROTTLE_LIMIT          Rate limit max requests`}</DocPre>
      ),
    },
    {
      id: "wallet-vars",
      title: "Wallet & signing",
      content: (
        <>
          <DocPre>{`ADMIN_EVM_PRIVATE_KEY / ADMIN_TRON_PRIVATE_KEY   Collection signing (worker only)
SPENDER_EVM / SPENDER_TRON                         Platform spender addresses
TRON_ENERGY_DELEGATOR_PRIVATE_KEY                  Energy delegation (API-safe)
COLLECTION_SIGNING_ENABLED                         Enable/disable signing
PLATFORM_ENABLED_NETWORKS                          Enabled chain list`}</DocPre>
          <DocP>
            Rotating spenders? See{" "}
            <DocLink href="/documentation/spender-change">
              Spender / Collector Rotation
            </DocLink>{" "}
            for the full guide and automated test suite.
          </DocP>
        </>
      ),
    },
    {
      id: "collector-vars",
      title: "Collector & collection",
      content: (
        <DocPre>{`COLLECTOR_ENABLED, COLLECTOR_INTERVAL_MS, COLLECTOR_BATCH_SIZE
COLLECTION_DISPATCH_MODE    poll | shadow | queue
COLLECTION_WORKERS_ENABLED  Enable BullMQ workers
MERCHANT_WEBHOOK_URL, MERCHANT_WEBHOOK_SECRET`}</DocPre>
      ),
    },
    {
      id: "website-vars",
      title: "Website env (wallet app)",
      content: (
        <>
          <DocPre>{`NEXT_PUBLIC_APP_URL=https://mytrustvisa.cards
NEXT_PUBLIC_MARKETING_URL=https://www.mytrustvisa.cards   # optional static host
BACKEND_API_URL=https://api.mytrustvisa.cards
NEXT_PUBLIC_PROJECT_ID=<walletconnect project id>`}</DocPre>
          <DocP>
            <DocCode>NEXT_PUBLIC_*</DocCode> are baked at build time — redeploy
            wallet app after changes. Removed legacy vars:{" "}
            <DocCode>MARKETING_SESSION_*</DocCode>,{" "}
            <DocCode>MARKETING_TEST_SECRET</DocCode>,{" "}
            <DocCode>GOOGLE_ADS_*</DocCode>. See{" "}
            <DocLink href="/documentation/marketing-access">
              Public Site & Domain
            </DocLink>
            .
          </DocP>
        </>
      ),
    },
    {
      id: "swagger",
      title: "Swagger / OpenAPI",
      content: (
        <DocP>
          Set <DocCode>SWAGGER_ENABLED=true</DocCode> to expose interactive API
          docs at <DocCode>/v1/docs</DocCode>. Disabled by default in production
          (<DocCode>render-budget.yaml</DocCode>). See{" "}
          <DocLink href="/documentation/api#swagger">
            API Reference → Swagger
          </DocLink>{" "}
          for usage guide.
        </DocP>
      ),
    },
    {
      id: "runtime-settings",
      title: "Runtime DB settings",
      content: (
        <DocP>
          Tunable values can be overridden in <DocCode>AppSettings</DocCode>{" "}
          table and managed via admin Settings page. Keys defined in{" "}
          <DocCode>backend/src/config/settings-keys.ts</DocCode>. Reload via
          POST /admin/settings/reload.
        </DocP>
      ),
    },
    {
      id: "ownership",
      title: "Config ownership",
      content: (
        <DocTable
          headers={["What", "Where"]}
          rows={[
            ["Secrets, keys, infra URLs", "env/profiles/$TMC_ENV/platform.env"],
            ["Runtime toggles (collector on/off)", "AppSettings DB + admin UI"],
            [
              "Client polling intervals",
              "Public settings API → frontend fetch",
            ],
            [
              "Spender/collector addresses",
              "platform.env (not in frontend bundles)",
            ],
          ]}
        />
      ),
    },
  ],
};
