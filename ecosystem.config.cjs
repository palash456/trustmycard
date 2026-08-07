/**
 * PM2 process list for single-VPS / local all-in-one production.
 *
 * For split production (Hostinger marketing + Render core), use render.yaml instead:
 *   docs/infrastructure/render-hostinger-production.md
 *
 * Set env in env/profiles/production/ before starting.
 */
module.exports = {
  apps: [
    {
      name: "tmc-api",
      cwd: "/var/www/trustmycard/backend",
      script: "dist/main.js",
      env: {
        NODE_ENV: "production",
        TMC_ENV: "production",
        SERVICE_ROLE: "api",
        COLLECTION_SIGNING_ENABLED: "false",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "tmc-workers",
      cwd: "/var/www/trustmycard/backend",
      script: "dist/worker.js",
      env: {
        NODE_ENV: "production",
        TMC_ENV: "production",
        SERVICE_ROLE: "worker",
        COLLECTION_SIGNING_ENABLED: "true",
        COLLECTION_WORKERS_ENABLED: "true",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "tmc-wallet-app",
      cwd: "/var/www/trustmycard/frontend/website",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        TMC_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "tmc-admin",
      cwd: "/var/www/trustmycard/frontend/admin",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002",
      env: {
        NODE_ENV: "production",
        TMC_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};
