#!/usr/bin/env node
import { runDeploy, runDryRun } from "./core/orchestrator.mjs";

function parseArgs(argv) {
  const options = {
    environment: "production",
    fresh: false,
    skipBuild: false,
    skipMigrate: false,
    provider: undefined,
    topology: undefined,
    confirmExternalData: false,
    confirmRecreateData: false,
    iAcceptDataLoss: false,
    dryRun: false,
  };

  const positionals = [];
  for (const arg of argv) {
    if (arg === "--fresh") options.fresh = true;
    else if (arg === "--skip-build") options.skipBuild = true;
    else if (arg === "--skip-migrate") options.skipMigrate = true;
    else if (arg === "--confirm-external-data") options.confirmExternalData = true;
    else if (arg === "--confirm-recreate-data") options.confirmRecreateData = true;
    else if (arg === "--i-accept-data-loss") options.iAcceptDataLoss = true;
    else if (arg.startsWith("--provider=")) options.provider = arg.split("=")[1];
    else if (arg.startsWith("--topology=")) options.topology = arg.split("=")[1];
    else if (arg === "--dry-run") options.dryRun = true;
    else if (!arg.startsWith("-")) positionals.push(arg);
  }

  if (positionals[0]) options.environment = positionals[0];
  return options;
}

function printHelp() {
  console.log(`Usage: ./deploy.sh [environment] [options]

Options:
  --fresh                      Provision data services (safe; never drops volumes by default)
  --provider=local|docker-vps  Target provider adapter
  --topology=micro|budget|full       Override manifest topology
  --skip-build                 Reuse existing local Docker images
  --skip-migrate               Skip prisma migrate deploy
  --confirm-external-data      Allow --fresh against external DATABASE_URL hosts
  --confirm-recreate-data      Allow removing the named bundled Postgres volume
  --dry-run                    Validate + compile env only (no Docker)
`);
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

if (options.dryRun) {
  runDryRun(options).catch((err) => {
    console.error(`[deploy] failed: ${err.message}`);
    process.exit(1);
  });
} else {
  runDeploy(options).catch((err) => {
    console.error(`[deploy] failed: ${err.message}`);
    process.exit(1);
  });
}
