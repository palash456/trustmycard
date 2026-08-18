import { spawnSync } from "child_process";
import { runCompose } from "./compose.mjs";

export function ensureBundledDataLayer(ctx) {
  if ((ctx.manifest.data?.mode ?? "bundled") !== "bundled") return;
  const code = runCompose(ctx, ["up", "-d", "postgres", "redis"], {});
  if (code !== 0) throw new Error("Failed to start postgres/redis");
  waitForPostgres(ctx);
}

function waitForPostgres(ctx) {
  const user = ctx.manifest.data?.bundled?.postgres_user ?? "trustmycard";
  for (let i = 0; i < 30; i += 1) {
    const code = runCompose(
      ctx,
      ["exec", "-T", "postgres", "pg_isready", "-U", user],
      {},
    );
    if (code === 0) return;
    spawnSync("sleep", ["2"]);
  }
  throw new Error("postgres did not become healthy in time");
}
