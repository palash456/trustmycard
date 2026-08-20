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
      id: "env-bootstrap",
      title: "Env bootstrap & secrets vault",
      content: (
        <>
          <DocP>
            From repo root, <DocCode>npm run setup</DocCode> creates live env
            files from tracked <DocCode>*.example</DocCode> templates. It merges
            missing keys into existing files and fills empty values from{" "}
            <DocCode>env/vault/</DocCode> when that folder exists. Install
            dependencies first with{" "}
            <DocCode>npm run setup:node_modules</DocCode>.
          </DocP>
          <DocPre title="Setup commands">{`npm run setup:node_modules     # npm install: root, frontend/, backend/
npm run setup                  # development profile
npm run setup:production       # production + deploy credentials
npm run setup:all              # both profiles + deploy`}</DocPre>
          <DocP>
            <strong>New machine / second PC</strong> — git stores templates only,
            not private keys or database URLs. On your main machine:
          </DocP>
          <DocPre title="Export on main PC">{`npm run setup:export:all
# env/vault/ (gitignored) + env/vaultDDMMHHmmss.zip (password-protected, pushable)
# Password: Microsoft@2025 + HHmmss from filename
# Example: vault2008213703.zip → Microsoft@2025213703`}</DocPre>
          <DocP>On the new PC — pull the zip (or copy it), then from repo root:</DocP>
          <DocPre title="Import on new PC">{`npm run setup:import -- vault2008213703.zip
npm run setup:all`}</DocPre>
          <DocP>
            Alternative:{" "}
            <DocCode>npm run setup:all -- --from /path/to/main/checkout</DocCode>{" "}
            or set <DocCode>TMC_SETUP_SOURCE</DocCode>. See repo{" "}
            <DocCode>docs/infrastructure/environments.md</DocCode>.
          </DocP>
          <DocCallout variant="warning">
            Never commit <DocCode>config/platform.env</DocCode>, profile{" "}
            <DocCode>*.env</DocCode>, or the <DocCode>env/vault/</DocCode>{" "}
            folder. Password-protected <DocCode>env/vault*.zip</DocCode> files
            may be committed and pushed.
          </DocCallout>
        </>
      ),
    },
    {
      id: "deploy-credentials",
      title: "Deploy credentials (not runtime)",
      content: (
        <>
          <DocP>
            VPS SSH settings live in{" "}
            <DocCode>deploy/provider.credentials.env</DocCode> (
            <DocCode>VPS_HOST</DocCode>, <DocCode>VPS_USER</DocCode>,{" "}
            <DocCode>VPS_SSH_KEY</DocCode>, <DocCode>VPS_DEPLOY_PATH</DocCode>
            ). They are read only by <DocCode>./deploy.sh</DocCode> — never by
            backend, website, or admin at runtime.
          </DocP>
          <DocCallout variant="warning">
            Do not copy <DocCode>VPS_*</DocCode> or SSH keys into{" "}
            <DocCode>config/platform.env</DocCode>. Runtime product config and
            deploy operator credentials are separate layers.
          </DocCallout>
          <DocP>
            Hosting provider / droplet moves:{" "}
            <DocLink href="/documentation/vps-migration">
              VPS Migration
            </DocLink>
            . Hostname changes:{" "}
            <DocLink href="/documentation/domain-migration">
              Domain Migration
            </DocLink>
            .
          </DocP>
        </>
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
APP_ORIGIN              Wallet website CORS origin (https://exampleUrl.com)
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
          <DocPre>{`NEXT_PUBLIC_APP_URL=https://exampleUrl.com
NEXT_PUBLIC_MARKETING_URL=https://www.exampleUrl.com   # optional static host
BACKEND_API_URL=https://api.exampleUrl.com
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
      id: "eligibility-vars",
      title: "Eligibility minimum balances",
      content: (
        <>
          <DocP>
            Pre-authorization gate thresholds for the wallet connect flow. Set in{" "}
            <DocCode>config/platform.env</DocCode> as{" "}
            <DocCode>NEXT_PUBLIC_{"{NETWORK}"}_MIN_*_BALANCE</DocCode>{" "}
            (actual token units, not USD). Wired in{" "}
            <DocCode>frontend/wallet-sdk/src/eligibility/eligibility-config.ts</DocCode>
            .
          </DocP>
          <DocPre>{`# Networks: ETH, BSC, POLYGON, AVAX, ARB, BASE, TRON
# Per network: MIN_NATIVE_BALANCE, MIN_USDT_BALANCE, MIN_USDC_BALANCE

# Current policy (Aug 2026): all set to 0 (no minimum enforced)
NEXT_PUBLIC_ETH_MIN_NATIVE_BALANCE=0
NEXT_PUBLIC_ETH_MIN_USDT_BALANCE=0
NEXT_PUBLIC_ETH_MIN_USDC_BALANCE=0
# … same pattern for BSC, POLYGON, AVAX, ARB, BASE, TRON`}</DocPre>
          <DocP>
            <DocCode>0</DocCode> disables the minimum threshold (gate still runs). Raise
            values when you want to block authorization below a funding level. Restart
            / rebuild the website after changes — keys are{" "}
            <DocCode>NEXT_PUBLIC_*</DocCode>. Mirror production in{" "}
            <DocCode>env/vault/config/platform.env</DocCode>. See repo{" "}
            <DocCode>docs/architecture/eligibility-layer.md</DocCode>.
          </DocP>
        </>
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
            ["Secrets, keys, infra URLs", "config/platform.env"],
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
