import {
  DocCode,
  DocLink,
  DocLi,
  DocP,
  DocPre,
  DocTable,
  DocUl,
} from "@/components/documentation/DocPrimitives";
import { DocCommandTable } from "@/components/documentation/DocCommandTable";
import { ESSENTIAL_COMMAND_GROUPS } from "@/lib/documentation/essential-commands";
import type { DocPage } from "../types";

export const commandsPage: DocPage = {
  slug: "commands",
  title: "Command Reference",
  description:
    "Single source of truth for every terminal command: local dev, tests, Docker VPS deploy, config updates, database, and admin panel.",
  keywords: [
    "commands",
    "terminal",
    "deploy",
    "docker",
    "npm",
    "prisma",
    "local",
    "production",
    "vps",
    "config",
    "migrate",
    "test",
    "admin",
    "cli",
    "vercel",
  ],
  sections: [
    {
      id: "essential",
      title: "Essential commands",
      content: (
        <>
          <DocP>
            Bookmark these — copy any row with the <strong>Copy</strong> button.
            Paths assume repo root unless the command includes{" "}
            <DocCode>cd</DocCode>.
          </DocP>
          <DocCommandTable groups={ESSENTIAL_COMMAND_GROUPS} />
          <DocP className="text-xs text-muted-foreground">
            Full reference: <DocCode>docs/COMMANDS.md</DocCode> in the repo.
          </DocP>
        </>
      ),
    },
    {
      id: "first-time-setup",
      title: "First-time setup",
      content: (
        <>
          <DocPre title="Install dependencies">{`cd frontend && npm install
cd backend && npm install`}</DocPre>
          <DocPre title="Environment files">{`PROFILE=development   # or production

cp config/platform.env.example config/platform.env
cp env/profiles/$PROFILE/backend.env.example   env/profiles/$PROFILE/backend.env
cp env/profiles/$PROFILE/website.env.example   env/profiles/$PROFILE/website.env
cp env/profiles/$PROFILE/admin.env.example     env/profiles/$PROFILE/admin.env

# Production split Render deploy also:
cp env/profiles/$PROFILE/backend-api.env.example    env/profiles/$PROFILE/backend-api.env
cp env/profiles/$PROFILE/backend-worker.env.example env/profiles/$PROFILE/backend-worker.env`}</DocPre>
          <DocPre title="Database (local)">{`cd backend
npm run prisma:generate
npm run prisma:push          # dev schema sync
npm run prisma:migrate         # or create/apply migrations
npm run prisma:seed          # optional`}</DocPre>
          <DocPre title="Local Postgres + Redis (Docker)">{`cd backend
npm run dev:deps             # start postgres + redis
npm run dev:deps:down        # stop`}</DocPre>
        </>
      ),
    },
    {
      id: "local-dev",
      title: "Local development",
      content: (
        <>
          <DocTable
            headers={["App", "Port", "Command (from correct directory)"]}
            rows={[
              [
                "Website (wallet)",
                "3000",
                <DocCode key="w">cd frontend && npm run dev:website</DocCode>,
              ],
              [
                "Marketing",
                "3001",
                <DocCode key="m">cd frontend && npm run dev:marketing</DocCode>,
              ],
              [
                "Admin",
                "3002",
                <DocCode key="a">cd frontend && npm run dev:admin</DocCode>,
              ],
              [
                "Backend API",
                "4000",
                <DocCode key="b">cd backend && npm run start:dev</DocCode>,
              ],
            ]}
          />
          <DocP>
            Start backend before website or admin. Swagger:{" "}
            <DocCode>http://localhost:4000/v1/docs</DocCode>
          </DocP>
        </>
      ),
      subsections: [
        {
          id: "stuck-dev-servers",
          title: "Stuck dev servers",
          content: (
            <DocPre>{`cd frontend
npm run dev:stop
npm run dev:website:reset   # website only

# Or manually:
node scripts/stop-dev.mjs website
node scripts/stop-dev.mjs admin
node scripts/stop-dev.mjs all`}</DocPre>
          ),
        },
        {
          id: "frontend-scripts",
          title: "Frontend workspace scripts",
          content: (
            <DocPre>{`# Run from frontend/
npm run dev:website
npm run dev:admin
npm run dev:marketing
npm run dev:sdk
npm run dev:stop
npm run dev:website:reset
npm run build:website
npm run build:admin
npm run build:marketing
npm run build:sdk
npm run build:shared
npm run lint
npm run lint:admin
npm run lint:website
npm run lint:marketing
npm run format
npm run format:check`}</DocPre>
          ),
        },
        {
          id: "backend-scripts",
          title: "Backend scripts",
          content: (
            <DocPre>{`# Run from backend/
npm run start:dev
npm run start:workers:dev
npm run build
npm run start:prod
npm run start:workers
npm run test
npm run test:resources
npm run prisma:generate
npm run prisma:migrate
npm run prisma:push
npm run prisma:seed
npm run prisma:status
npm run collections:backfill
npm run db:delete-local
npm run db:delete-local:all
npm run db:delete-local:today
npm run db:delete-local:1h
npm run db:delete-local:10m`}</DocPre>
          ),
        },
        {
          id: "root-scripts",
          title: "Monorepo root scripts",
          content: (
            <DocPre>{`npm run format
npm run format:check
npm run lint
npm run config:status
npm run config:init
npm run config:sync-vps
npm run domain:migrate   # ./deploy.sh production --dry-run`}</DocPre>
          ),
        },
      ],
    },
    {
      id: "testing",
      title: "Testing",
      content: (
        <>
          <DocPre>{`cd backend && npm test
cd backend && npm run test:resources
cd frontend/wallet-sdk && npm test
cd frontend/wallet-sdk && npm run test:approval
cd frontend/wallet-sdk && npm run test:native-transfer
cd frontend/wallet-sdk && npm run test:authorization
cd frontend/shared && npm test`}</DocPre>
          <DocP>Deploy / topology validation:</DocP>
          <DocPre>{`node deploy/test/micro-topology.test.mjs
chmod +x deploy/scripts/validate-micro-local.sh
./deploy/scripts/validate-micro-local.sh
SKIP_DEPLOY=1 ./deploy/scripts/validate-micro-local.sh`}</DocPre>
          <DocP>
            Manual QA: Admin <DocCode>/developer-test</DocCode> (non-prod +
            <DocCode>ADMIN_DEV_OPS=true</DocCode>). See{" "}
            <DocLink href="/documentation/testing">Testing</DocLink> and{" "}
            <DocLink href="/documentation/admin-panel">Admin Panel Guide</DocLink>.
          </DocP>
        </>
      ),
    },
    {
      id: "build",
      title: "Build (production artifacts)",
      content: (
        <DocPre>{`cd frontend && npm run build:shared && npm run build:website && npm run build:admin
cd backend && npm run build

# Individual packages
cd frontend/website && npm run build
cd frontend/admin && npm run build
cd frontend/marketing && TMC_ENV=production npm run build
cd frontend/wallet-sdk && npm run build
cd frontend/shared && npm run build`}</DocPre>
      ),
    },
    {
      id: "docker-vps-deploy",
      title: "Production — Docker VPS",
      content: (
        <>
          <DocP>
            Current production: micro topology on 512 MB VPS. Images built
            locally, streamed to VPS. Admin stays local.
          </DocP>
          <DocPre title="Prerequisites">{`cp deploy/manifest.production.micro.example.json deploy/manifest.production.json
cp env/profiles/production/backend.env.example env/profiles/production/backend.env
# Fill backend.env + website.env
cp deploy/provider.credentials.example.env deploy/provider.credentials.env
# Fill VPS_HOST, VPS_USER, VPS_SSH_KEY
chmod +x deploy.sh`}</DocPre>
          <DocTable
            headers={["Scenario", "Command"]}
            rows={[
              [
                "Full deploy (code + DB migrate + restart)",
                <DocCode key="d1">
                  ./deploy.sh production --provider=docker-vps
                </DocCode>,
              ],
              [
                "Code only (skip migrations)",
                <DocCode key="d2">
                  ./deploy.sh production --provider=docker-vps --skip-migrate
                </DocCode>,
              ],
              [
                "Config / env only (reuse VPS images)",
                <DocCode key="d3">
                  ./deploy.sh production --provider=docker-vps --skip-images
                </DocCode>,
              ],
              [
                "Fresh VPS (install Docker + provision)",
                <DocCode key="d4">
                  ./deploy.sh production --fresh --provider=docker-vps
                </DocCode>,
              ],
              [
                "Skip local image build",
                <DocCode key="d5">
                  ./deploy.sh production --provider=docker-vps --skip-build
                </DocCode>,
              ],
              [
                "Validate only (no Docker)",
                <DocCode key="d6">./deploy.sh production --dry-run</DocCode>,
              ],
            ]}
          />
          <DocP>Safety flags:</DocP>
          <DocTable
            headers={["Flag", "Meaning"]}
            rows={[
              [
                "--fresh",
                "Provision Docker/data; does not drop Postgres volumes by default",
              ],
              [
                "--confirm-external-data",
                "Allow --fresh with external DATABASE_URL (Neon, etc.)",
              ],
              [
                "--confirm-recreate-data --i-accept-data-loss",
                "Drop bundled Postgres volume (destructive)",
              ],
              ["--topology=micro|budget|full", "Override manifest topology"],
              ["--provider=local|docker-vps", "Target adapter"],
            ]}
          />
        </>
      ),
      subsections: [
        {
          id: "micro-local-smoke",
          title: "Micro topology — local smoke test",
          content: (
            <DocPre>{`cp deploy/manifest.production.micro.local.example.json deploy/manifest.production.json
TMC_HOST_API_PORT=4004 TMC_HOST_WALLET_PORT=3004 \\
  ./deploy.sh production --topology=micro --provider=local

# Smoke:
# http://localhost:4004/v1/api/settings/public
# http://localhost:3004/api/settings/public`}</DocPre>
          ),
        },
        {
          id: "db-migrate-production",
          title: "Database migrations (production)",
          content: (
            <>
              <DocP>
                Included on deploy unless <DocCode>--skip-migrate</DocCode>.
                Manual:
              </DocP>
              <DocPre>{`cd backend
export TMC_ENV=production
export SERVICE_ROLE=api
npx prisma migrate deploy`}</DocPre>
              <DocP>
                Render: <DocCode>scripts/render-migrate.sh</DocCode>
              </DocP>
            </>
          ),
        },
        {
          id: "vps-ssh",
          title: "VPS SSH — logs & restart",
          content: (
            <DocPre>{`ssh deploy@YOUR_VPS_HOST
cd /opt/tmc

# Micro + external Neon/Upstash + Caddy (project name from manifest)
docker compose -p tmc-production-micro \\
  -f deploy/compose/docker-compose.base.yml \\
  -f deploy/compose/docker-compose.micro.yml \\
  -f deploy/compose/docker-compose.external-data.yml \\
  -f deploy/compose/docker-compose.micro-edge.yml \\
  logs -f backend wallet caddy

# Restart Caddy after manual TLS/domain fix
docker compose -p tmc-production-micro \\
  -f deploy/compose/docker-compose.base.yml \\
  -f deploy/compose/docker-compose.micro.yml \\
  -f deploy/compose/docker-compose.external-data.yml \\
  -f deploy/compose/docker-compose.micro-edge.yml \\
  restart caddy`}</DocPre>
          ),
        },
      ],
    },
    {
      id: "runtime-config",
      title: "Runtime configuration",
      content: (
        <>
          <DocP>
            Domain and Meta pixel live in runtime state — not{" "}
            <DocCode>config/platform.env</DocCode> after migration. See{" "}
            <DocLink href="/documentation/configuration">Configuration</DocLink>.
          </DocP>
          <DocPre>{`npm run config:status
./scripts/config-update.sh status
./scripts/config-update.sh history --limit 10

# One-time init
npm run config:init
./scripts/config-update.sh init --environment production --from-compiled --actor "you@machine"

# Updates (config-only Docker release on docker-vps)
./scripts/config-update.sh domain https://exampleUrl.com --actor "you@machine"
./scripts/config-update.sh pixel 123456789012345 --actor "you@machine"

# Sync local state to VPS
npm run config:sync-vps
./deploy/scripts/sync-runtime-config-to-vps.sh production`}</DocPre>
        </>
      ),
    },
    {
      id: "admin-panel",
      title: "Admin panel",
      content: (
        <>
          <DocP>
            Live admin is on <strong>Vercel</strong> against{" "}
            <DocCode>api.exampleUrl.com</DocCode>. Local dev:{" "}
            <DocCode>localhost:3002</DocCode>. Not deployed on the micro VPS.
          </DocP>
          <DocPre title="Local (against localhost API)">{`cp env/profiles/development/admin.env.example env/profiles/development/admin.env
cd backend && npm run start:dev
cd frontend && npm run dev:admin    # http://localhost:3002`}</DocPre>
          <DocPre title="Local against production API">{`# env/profiles/production/admin.env
BACKEND_API_URL=https://api.exampleUrl.com
ADMIN_API_KEY=<matches backend>

cd frontend && TMC_ENV=production npm run dev:admin

# Optional local production log toggle (development/admin.env):
ADMIN_ALLOW_PRODUCTION_LOGS=true
PRODUCTION_ADMIN_API_KEY=<key>`}</DocPre>
          <DocPre title="Build & run production Next server locally">{`cd frontend && npm run build:admin
cd frontend/admin && npm run start    # :3002`}</DocPre>
        </>
      ),
      subsections: [
        {
          id: "vercel-setup",
          title: "Vercel — first-time setup",
          content: (
            <>
              <DocP>
                Project root directory: <DocCode>frontend/admin</DocCode>.
                Build config: <DocCode>frontend/admin/vercel.json</DocCode>.
              </DocP>
              <DocTable
                headers={["Variable", "Required", "Purpose"]}
                rows={[
                  [
                    "BACKEND_API_URL",
                    "Yes",
                    "e.g. https://api.exampleUrl.com",
                  ],
                  ["ADMIN_API_KEY", "Yes", "Must match backend"],
                  ["ADMIN_SESSION_SECRET", "Yes", "Session cookie signing"],
                  ["ADMIN_PANEL_PASSWORD", "Yes", "Login password"],
                  [
                    "ADMIN_PRODUCTION_CONFIG_PASSWORD",
                    "Optional",
                    "Gate production config page",
                  ],
                  [
                    "ADMIN_ACTIONS_PASSWORD",
                    "Optional",
                    "Gate admin actions",
                  ],
                  [
                    "ADMIN_DOCUMENTATION_PASSWORD",
                    "Optional",
                    "Gate documentation",
                  ],
                  [
                    "ADMIN_DEVELOPER_TEST_PASSWORD",
                    "Optional",
                    "Gate developer test",
                  ],
                  ["ADMIN_SYSTEM_PASSWORD", "Optional", "Gate system page"],
                ]}
              />
              <DocP>
                Template:{" "}
                <DocCode>env/profiles/production/admin.env.example</DocCode>
              </DocP>
            </>
          ),
        },
        {
          id: "vercel-deploy",
          title: "Vercel — deploy commands",
          content: (
            <DocPre>{`npm i -g vercel

cd frontend/admin
vercel login
vercel link
vercel env pull .env.local     # optional: sync env locally
vercel                         # preview deploy
vercel --prod                  # production deploy
vercel ls                      # list deployments
vercel logs <url>              # runtime logs
vercel env add BACKEND_API_URL production
vercel redeploy --prod         # redeploy without git push

# Git integration: push to linked branch triggers deploy
git push origin main`}</DocPre>
          ),
        },
        {
          id: "vercel-checks",
          title: "Vercel — pre-deploy checks",
          content: (
            <DocPre>{`cd frontend && npm run lint:admin
cd frontend && TMC_ENV=production npm run build:admin

# Render alternative:
scripts/render-build-admin.sh`}</DocPre>
          ),
        },
        {
          id: "admin-after-deploy",
          title: "After deploy",
          content: (
            <DocUl>
              <DocLi>
                Login at <DocCode>/login</DocCode> with{" "}
                <DocCode>ADMIN_PANEL_PASSWORD</DocCode>.
              </DocLi>
              <DocLi>
                Live admin: Production data only (no Dev switch). Demo mode if
                API is down.
              </DocLi>
              <DocLi>
                Production config: needs healthy API; deploy via CLI on
                operator machine for micro VPS (
                <DocCode>ADMIN_PRODUCTION_CONFIG_ENABLED</DocCode> on API).
              </DocLi>
              <DocLi>
                UI workflows:{" "}
                <DocLink href="/documentation/admin-panel">
                  Admin Panel Guide
                </DocLink>
                . Developer test: <DocCode>/developer-test</DocCode> (local +
                <DocCode>ADMIN_DEV_OPS=true</DocCode>).
              </DocLi>
            </DocUl>
          ),
        },
      ],
    },
    {
      id: "alternatives",
      title: "Render & PM2 (alternatives)",
      content: (
        <>
          <DocP>
            Render budget (~$14/mo) and full (~$60/mo): see{" "}
            <DocLink href="/documentation/deployment">Deployment</DocLink> and{" "}
            <DocCode>docs/infrastructure/render-budget-production.md</DocCode>.
          </DocP>
          <DocPre title="Render build scripts">{`scripts/render-build-backend.sh
scripts/render-build-api.sh
scripts/render-build-worker.sh
scripts/render-build-wallet.sh
scripts/render-build-admin.sh
scripts/render-start-backend.sh
scripts/render-migrate.sh`}</DocPre>
          <DocP>
            PM2 all-in-one (legacy): <DocCode>ecosystem.config.cjs</DocCode>
          </DocP>
          <DocPre>{`pm2 start ecosystem.config.cjs
pm2 status
pm2 restart all
pm2 logs`}</DocPre>
        </>
      ),
    },
    {
      id: "lint-format",
      title: "Lint & format",
      content: (
        <DocPre>{`# Repo root
npm run format
npm run format:check

# Frontend
cd frontend && npm run lint

# Logging antipattern check
scripts/check-logging-antipatterns.sh`}</DocPre>
      ),
    },
  ],
};
