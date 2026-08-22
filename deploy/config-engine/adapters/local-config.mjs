import { runCompose } from "../../core/compose.mjs";

export const localConfigAdapter = {
  async releaseConfigOnly(ctx) {
    const logOpts = ctx.onLog ? { onLog: ctx.onLog } : {};

    if (ctx.changedKey === "META_PIXEL_ID") {
      if (
        runCompose(ctx, ["up", "-d", "--force-recreate", "wallet"], logOpts) !==
        0
      ) {
        throw new Error("docker compose wallet recreate failed");
      }
      return;
    }

    const services = ["backend", "wallet", "caddy"];
    if (runCompose(ctx, ["up", "-d", ...services], logOpts) !== 0) {
      throw new Error("docker compose config-only release failed");
    }
    if (ctx.changedKey === "WEBSITE_DOMAIN") {
      if (runCompose(ctx, ["restart", "caddy"], logOpts) !== 0) {
        throw new Error("docker compose caddy restart failed after domain change");
      }
    }
  },
};
