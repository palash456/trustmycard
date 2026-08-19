import { runCompose } from "../../core/compose.mjs";
export const localConfigAdapter = {
  async releaseConfigOnly(ctx) {
    const services =
      ctx.changedKey === "META_PIXEL_ID"
        ? ["wallet"]
        : ["backend", "wallet", "caddy"];
    if (runCompose(ctx, ["up", "-d", ...services]) !== 0)
      throw new Error("docker compose config-only release failed");
    if (ctx.changedKey === "WEBSITE_DOMAIN") {
      if (runCompose(ctx, ["restart", "caddy"]) !== 0)
        throw new Error("docker compose caddy restart failed after domain change");
    }
  },
};
