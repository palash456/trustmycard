import { Injectable, ForbiddenException } from "@nestjs/common";
import { spawn } from "child_process";
import { join } from "path";

@Injectable()
export class AdminDevOpsService {
  private devOpsEnabled(): boolean {
    if (process.env.NODE_ENV === "production") return false;
    return (process.env.ADMIN_DEV_OPS ?? "").toLowerCase() === "true";
  }

  assertDevOps(): void {
    if (!this.devOpsEnabled()) {
      throw new ForbiddenException("Dev ops endpoints are disabled");
    }
  }

  restartBackend(): { ok: boolean; message: string } {
    this.assertDevOps();
    const script = join(process.cwd(), "scripts", "dev-restart-backend.mjs");
    spawn("node", [script], {
      detached: true,
      stdio: "ignore",
    }).unref();
    return { ok: true, message: "Backend restart initiated" };
  }

  restartWebsite(): { ok: boolean; message: string } {
    this.assertDevOps();
    const script = join(
      process.cwd(),
      "..",
      "frontend",
      "scripts",
      "dev-restart-website.mjs",
    );
    spawn("node", [script], {
      detached: true,
      stdio: "ignore",
    }).unref();
    return { ok: true, message: "Website restart initiated" };
  }
}
