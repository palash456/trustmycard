export type EssentialCommand = {
  id: string;
  title: string;
  command: string;
  description: string;
};

export type EssentialCommandGroup = {
  id: string;
  title: string;
  hint?: string;
  commands: EssentialCommand[];
};

export const ESSENTIAL_COMMAND_GROUPS: EssentialCommandGroup[] = [
  {
    id: "env-setup",
    title: "Environment setup (new machine)",
    hint: "Run export on your main PC before moving to a new machine.",
    commands: [
      {
        id: "setup-dev",
        title: "Bootstrap dev env files",
        command: "npm run setup",
        description: "Create config/platform.env + development profile from templates",
      },
      {
        id: "setup-all",
        title: "Bootstrap all env files",
        command: "npm run setup:all",
        description: "Development + production profiles + deploy credentials",
      },
      {
        id: "setup-export-all",
        title: "Export secrets vault + zip",
        command: "npm run setup:export:all",
        description:
          "Writes env/vault/ and password-protected env/vaultDDMMHHmmss.zip (pushable). Password: Microsoft@2025 + HHmmss",
      },
      {
        id: "setup-import",
        title: "Import vault zip on new PC",
        command:
          "npm run setup:import -- vaultDDMMHHmmss.zip && npm run setup:all",
        description:
          "Unzip with auto-derived password, then bootstrap env files with secrets",
      },
    ],
  },
  {
    id: "local-dev",
    title: "Local dev (daily)",
    hint: "Start backend before admin or website.",
    commands: [
      {
        id: "backend-dev",
        title: "Backend API",
        command: "cd backend && npm run start:dev",
        description: "Nest API on http://localhost:4000",
      },
      {
        id: "wallet-dev",
        title: "Wallet app",
        command: "cd frontend && npm run dev:website",
        description: "Product app on http://localhost:3000",
      },
      {
        id: "admin-dev",
        title: "Admin panel",
        command: "cd frontend && npm run dev:admin",
        description: "Ops console on http://localhost:3002",
      },
      {
        id: "marketing-dev",
        title: "Marketing preview",
        command: "cd frontend && npm run dev:marketing",
        description: "Optional static marketing preview on :3001",
      },
    ],
  },
  {
    id: "stuck-dev",
    title: "Stuck dev servers",
    commands: [
      {
        id: "dev-stop",
        title: "Stop dev servers",
        command: "cd frontend && npm run dev:stop",
        description: "Kill stale Next.js / dev processes",
      },
      {
        id: "website-reset",
        title: "Reset website dev",
        command: "cd frontend && npm run dev:website:reset",
        description: "Stop website dev server and clear lock files",
      },
    ],
  },
  {
    id: "docker-vps",
    title: "Production VPS (Docker)",
    commands: [
      {
        id: "deploy-full",
        title: "Full deploy",
        command: "./deploy.sh production --provider=docker-vps",
        description: "Build images, run DB migrate, restart containers",
      },
      {
        id: "deploy-code",
        title: "Code only",
        command:
          "./deploy.sh production --provider=docker-vps --skip-migrate",
        description: "Deploy code/images without database migrations",
      },
      {
        id: "deploy-config",
        title: "Config / env only",
        command: "./deploy.sh production --provider=docker-vps --skip-images",
        description: "Reuse VPS images — no rebuild, no migrate",
      },
      {
        id: "deploy-fresh",
        title: "Fresh VPS",
        command:
          "./deploy.sh production --fresh --provider=docker-vps",
        description: "First deploy — provision Docker on new host",
      },
      {
        id: "deploy-dry-run",
        title: "Validate (dry-run)",
        command: "./deploy.sh production --dry-run",
        description: "Compile env and validate manifest — no Docker",
      },
    ],
  },
  {
    id: "runtime-config",
    title: "Runtime config (domain / Meta pixel)",
    hint: "Config-only release on docker-vps — no image build, no prisma migrate.",
    commands: [
      {
        id: "config-status",
        title: "Config status",
        command: "npm run config:status",
        description: "Show current runtime config state",
      },
      {
        id: "config-domain",
        title: "Update domain",
        command:
          './scripts/config-update.sh domain https://exampleUrl.com --actor "you@machine"',
        description: "Deploy new WEBSITE_DOMAIN (restarts caddy, backend, wallet)",
      },
      {
        id: "config-pixel",
        title: "Update Meta pixel",
        command:
          './scripts/config-update.sh pixel YOUR_PIXEL_ID --actor "you@machine"',
        description: "Deploy new META_PIXEL_ID (restarts wallet)",
      },
      {
        id: "config-sync",
        title: "Sync state to VPS",
        command: "npm run config:sync-vps",
        description: "Upload local runtime-config JSON to VPS",
      },
    ],
  },
  {
    id: "tests",
    title: "Tests (before deploy)",
    commands: [
      {
        id: "test-backend",
        title: "Backend",
        command: "cd backend && npm test",
        description: "NestJS unit and integration specs",
      },
      {
        id: "test-wallet-sdk",
        title: "Wallet SDK",
        command: "cd frontend/wallet-sdk && npm test",
        description: "Connect flow and approval tests",
      },
      {
        id: "test-shared",
        title: "Shared package",
        command: "cd frontend/shared && npm test",
        description: "Flow IDs, lifecycle, shared schemas",
      },
    ],
  },
  {
    id: "vercel-admin",
    title: "Live admin — Vercel deploy",
    hint: "Root directory frontend/admin. Env: env/profiles/production/admin.env.example",
    commands: [
      {
        id: "vercel-install",
        title: "Install Vercel CLI",
        command: "npm i -g vercel",
        description: "One-time global install",
      },
      {
        id: "vercel-link",
        title: "Login and link project",
        command: "cd frontend/admin && vercel login && vercel link",
        description: "Authenticate and link to Vercel project",
      },
      {
        id: "vercel-env-pull",
        title: "Pull env locally",
        command: "cd frontend/admin && vercel env pull .env.local",
        description: "Download Vercel env vars for local prod build",
      },
      {
        id: "vercel-preview",
        title: "Preview deploy",
        command: "cd frontend/admin && vercel",
        description: "Deploy preview branch to Vercel",
      },
      {
        id: "vercel-prod",
        title: "Production deploy",
        command: "cd frontend/admin && vercel --prod",
        description: "Deploy live admin to production URL",
      },
      {
        id: "admin-build",
        title: "Build admin (pre-deploy)",
        command: "cd frontend && TMC_ENV=production npm run build:admin",
        description: "Same build step Vercel runs in CI",
      },
      {
        id: "admin-lint",
        title: "Lint admin",
        command: "cd frontend && npm run lint:admin",
        description: "ESLint before Vercel deploy",
      },
    ],
  },
];
