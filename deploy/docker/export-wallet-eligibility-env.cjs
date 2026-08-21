#!/usr/bin/env node
/**
 * Print shell `export KEY=value` lines for eligibility NEXT_PUBLIC_* vars.
 * Used by deploy/docker/load-wallet-build-env.sh before wallet Docker builds.
 */
const { loadTmcEnv } = require("../../config/load-env.mjs");
const { eligibilityEnvFromProcess } = require("../../config/eligibility-env.mjs");

loadTmcEnv("website");

for (const [key, value] of Object.entries(eligibilityEnvFromProcess())) {
  process.stdout.write(`export ${key}=${JSON.stringify(value)}\n`);
}
