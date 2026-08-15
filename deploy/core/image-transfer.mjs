import { homedir } from "os";
import { join } from "path";
import { spawn } from "child_process";

function expandHome(path) {
  if (!path) return path;
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function runTransfer(saveArgs, loadArgs) {
  return new Promise((resolve, reject) => {
    const save = spawn("docker", saveArgs, { stdio: ["ignore", "pipe", "inherit"] });
    const load = spawn(loadArgs[0], loadArgs.slice(1), {
      stdio: ["pipe", "inherit", "inherit"],
    });

    save.stdout.pipe(load.stdin);

    let saveCode = null;
    let loadCode = null;

    const maybeDone = () => {
      if (saveCode === null || loadCode === null) return;
      if (saveCode !== 0) reject(new Error("docker save failed"));
      else if (loadCode !== 0) reject(new Error("Image transfer to VPS failed"));
      else resolve();
    };

    save.on("error", reject);
    load.on("error", reject);
    save.on("close", (code) => {
      saveCode = code;
      if (load.stdin.writable) load.stdin.end();
      maybeDone();
    });
    load.on("close", (code) => {
      loadCode = code;
      maybeDone();
    });
  });
}

export function transferImagesToHost(creds, imageTags) {
  const tags = [...new Set(imageTags.filter(Boolean))];
  if (tags.length === 0) return Promise.resolve();

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
  console.log(
    "[image-transfer] packaging + uploading (no progress bar — large images can take several minutes)…",
  );

  return runTransfer(["save", ...tags], sshParts);
}
