import { dockerVpsAdapter } from "../../adapters/docker-vps.mjs";
import { shouldUseLocalVpsConfigDeploy } from "../deploy-target.mjs";
import { localConfigAdapter } from "./local-config.mjs";

// The existing adapter's --skip-images release reuses images. This specialized
// adapter narrows service restarts; deployment transfer remains adapter-owned.
export const dockerVpsConfigAdapter = {
  async releaseConfigOnly(ctx) {
    if (shouldUseLocalVpsConfigDeploy()) {
      ctx.onLog?.(
        "Local VPS config deploy: restarting services via Docker socket (no SSH/rsync)",
      );
      return localConfigAdapter.releaseConfigOnly(ctx);
    }

    const original = ctx.options;
    ctx.options = {
      ...original,
      skipImages: true,
      skipMigrate: true,
      configOnlyServices:
        ctx.changedKey === "META_PIXEL_ID"
          ? ["wallet"]
          : ["caddy", "backend", "wallet"],
      // Bind-mounted Caddyfile changes are not picked up by `compose up -d`.
      ...(ctx.changedKey === "WEBSITE_DOMAIN"
        ? { forceRestartServices: ["caddy"] }
        : {}),
    };
    try {
      await dockerVpsAdapter.release(ctx);
    } finally {
      ctx.options = original;
    }
  },
};
