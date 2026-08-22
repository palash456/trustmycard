#!/usr/bin/env node
import {
  getConfigHistory,
  getProductionConfig,
  updateMetaPixelId,
  updateWebsiteDomain,
} from "./index.mjs";
import { readPlatformDefaults } from "./validators.mjs";
import { repoRoot } from "../core/types.mjs";
import { migrateInit } from "./migrate-init.mjs";
const args = process.argv.slice(2),
  command = args[0],
  json = args.includes("--json");
const flag = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const environment = flag("--environment") ?? "production",
  actor =
    flag("--actor") ??
    `${process.env.USER ?? "unknown"}@${process.env.HOSTNAME ?? "localhost"}`;
const print = (value) =>
  console.log(
    json
      ? JSON.stringify(value)
      : typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2),
  );
const onEvent = (event) => print(event);
async function main() {
  if (!command || command === "--help")
    return print(
      "Usage: config-update.sh status|history [--limit N]|init [--from-compiled] [--domain host] [--pixel id] --actor actor|domain https://host|pixel id [--actor actor] [--json]. Updates are configuration-only: no image rebuild or database migration.",
    );
  if (command === "status")
    return print({
      state: await getProductionConfig(environment),
      platformDefaults: readPlatformDefaults(repoRoot),
    });
  if (command === "history")
    return print(
      await getConfigHistory(environment, { limit: flag("--limit") }),
    );
  if (command === "init")
    return print(
      await migrateInit({
        environment,
        domain: flag("--domain"),
        pixel: flag("--pixel"),
        actor,
        source: flag("--source") ?? "MIGRATION",
        fromCompiled: args.includes("--from-compiled"),
      }),
    );
  if (command === "domain")
    return print(
      await updateWebsiteDomain({
        environment,
        requestedValue: args[1],
        actor,
        source: flag("--source") ?? "CLI",
        onEvent,
      }),
    );
  if (command === "pixel")
    return print(
      await updateMetaPixelId({
        environment,
        requestedValue: args[1],
        actor,
        source: flag("--source") ?? "CLI",
        onEvent,
      }),
    );
  throw new Error(`Unknown command: ${command}`);
}
main().catch((error) => {
  const payload = {
    phase: "complete",
    message: "FAILED",
    result: "FAILED",
    error: error.message,
    at: new Date().toISOString(),
  };
  if (json) console.log(JSON.stringify(payload));
  else console.error(error.message);
  process.exit(1);
});
