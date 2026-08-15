import { execSync } from "child_process";

function parseDatabaseHost(databaseUrl) {
  if (!databaseUrl) return "";
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function assertFreshSafety(ctx) {
  const { manifest, options, compiled } = ctx;
  const dataMode = manifest.data?.mode ?? "bundled";
  const projectName =
    manifest.compose?.project_name ?? `tmc-${manifest.environment ?? "production"}`;
  const volumeName = `${projectName}_postgres_data`;

  if (options.fresh && dataMode === "external") {
    const host = parseDatabaseHost(compiled.meta.databaseUrl);
    const protectedHosts = manifest.safety?.protected_db_hosts ?? [];
    const isProtected = protectedHosts.some((h) => host.includes(h));
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "postgres" ||
      host === "";

    if (!isLocal && !options.confirmExternalData) {
      throw new Error(
        `[safety] --fresh with data.mode=external targets non-local database host "${host}". ` +
          "Refusing to run. Pass --confirm-external-data only if you intentionally want to migrate against that database.",
      );
    }
    if (isProtected && !options.confirmExternalData) {
      throw new Error(
        `[safety] --fresh refused: DATABASE_URL host "${host}" matches protected production host list. ` +
          "Pass --confirm-external-data to proceed (migrations only — no data wipe).",
      );
    }
  }

  if (options.fresh && dataMode === "bundled") {
    let volumeExists = false;
    try {
      const out = execSync("docker volume ls --format '{{.Name}}'", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      volumeExists = out
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .includes(volumeName);
    } catch {
      // docker unavailable — provision step will fail later
    }

    if (volumeExists && !options.confirmRecreateData) {
      throw new Error(
        `[safety] --fresh found existing Postgres volume "${volumeName}". ` +
          "Refusing to continue to avoid overwriting production data. " +
          "Use a new compose.project_name in the manifest, or pass --confirm-recreate-data to remove ONLY that named volume.",
      );
    }
  }

  if (options.confirmRecreateData && !options.iAcceptDataLoss) {
    throw new Error(
      "[safety] --confirm-recreate-data requires --i-accept-data-loss",
    );
  }

  return { volumeName, projectName };
}

export function recreateBundledVolume(volumeName, options) {
  if (!options.confirmRecreateData || !options.iAcceptDataLoss) return;
  try {
    execSync(`docker volume rm -f ${volumeName}`, { stdio: "inherit" });
    console.log(`[safety] removed volume ${volumeName}`);
  } catch (err) {
    throw new Error(`Failed to remove volume ${volumeName}: ${err.message}`);
  }
}
