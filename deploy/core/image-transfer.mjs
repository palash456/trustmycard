import { homedir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";

function expandHome(path) {
  if (!path) return path;
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

export function transferImagesToHost(creds, imageTags) {
  const tags = [...new Set(imageTags.filter(Boolean))];
  if (tags.length === 0) return;

  const user = creds.VPS_USER || "deploy";
  const host = creds.VPS_HOST;
  if (!host) throw new Error("VPS_HOST is required for image transfer");
  const sshParts = ["ssh", "-o", "StrictHostKeyChecking=accept-new"];
  if (creds.VPS_SSH_KEY) {
    sshParts.push("-i", expandHome(creds.VPS_SSH_KEY));
  }
  sshParts.push(`${user}@${host}`, "docker", "load");
  const tagList = tags.join(" ");

  console.log(
    `[image-transfer] streaming ${tags.length} image(s) to ${host}: ${tagList}`,
  );

  const save = spawnSync("docker", ["save", ...tags], {
    encoding: "buffer",
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (save.status !== 0) {
    throw new Error("docker save failed");
  }

  const load = spawnSync(sshParts[0], sshParts.slice(1), {
    input: save.stdout,
    stdio: ["pipe", "inherit", "inherit"],
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (load.status !== 0) {
    throw new Error("Image transfer to VPS failed");
  }
}
