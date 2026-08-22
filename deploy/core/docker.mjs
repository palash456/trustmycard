import { spawnSync } from "child_process";

export function ensureDockerDaemon() {
  const result = spawnSync("docker", ["info"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (result.status === 0) return;

  const hint =
    process.platform === "darwin"
      ? "Start Docker Desktop (open -a Docker) and wait until it shows as running."
      : "Start the Docker daemon and retry.";
  throw new Error(`Docker daemon is not running. ${hint}`);
}
