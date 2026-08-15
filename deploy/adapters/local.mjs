import { releaseComponents } from "../core/types.mjs";
import { runCompose } from "../core/compose.mjs";
import { ensureBundledDataLayer } from "../core/data-layer.mjs";

export const localAdapter = {
  name: "local",

  async provision(ctx) {
    console.log("[adapter:local] provision");
    ensureBundledDataLayer(ctx);
  },

  async release(ctx) {
    console.log("[adapter:local] release");
    const services = [];
    if ((ctx.manifest.data?.mode ?? "bundled") === "bundled") {
      services.push("postgres", "redis");
    }
    services.push(...releaseComponents(ctx.topology, ctx.options));
    const code = runCompose(ctx, ["up", "-d", "--remove-orphans", ...services], {});
    if (code !== 0) throw new Error("docker compose up failed");
  },
};
