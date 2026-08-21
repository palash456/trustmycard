import { homedir } from "os";
import { join } from "path";
import { spawn } from "child_process";

const MAX_ATTEMPTS = 3;

function expandHome(path) {
  if (!path) return path;
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function sshOptionArgs(creds) {
  const args = [
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ServerAliveInterval=30",
    "-o",
    "ServerAliveCountMax=120",
    "-o",
    "TCPKeepAlive=yes",
    "-o",
    "ConnectTimeout=30",
  ];
  if (creds.VPS_SSH_KEY) {
    args.push("-i", expandHome(creds.VPS_SSH_KEY));
  }
  return args;
}

function isBenignPipeError(err) {
  return err?.code === "EPIPE" || err?.code === "ERR_STREAM_DESTROYED";
}

function attachPipeErrorHandlers(streams, fail) {
  for (const stream of streams) {
    stream.on("error", (err) => {
      if (!isBenignPipeError(err)) fail(err);
    });
  }
}

function killQuietly(proc) {
  if (proc && !proc.killed) proc.kill("SIGTERM");
}

function runTransfer(saveArgs, loadArgs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let save;
    let gzip;
    let load;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      killQuietly(save);
      killQuietly(gzip);
      killQuietly(load);
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    save = spawn("docker", saveArgs, {
      stdio: ["ignore", "pipe", "inherit"],
    });
    gzip = spawn("gzip", ["-c"], { stdio: ["pipe", "pipe", "inherit"] });
    load = spawn(loadArgs[0], loadArgs.slice(1), {
      stdio: ["pipe", "inherit", "inherit"],
    });

    save.stdout.pipe(gzip.stdin);
    gzip.stdout.pipe(load.stdin);

    attachPipeErrorHandlers(
      [save.stdout, gzip.stdin, gzip.stdout, load.stdin],
      fail,
    );

    save.on("error", fail);
    gzip.on("error", fail);
    load.on("error", fail);

    let saveCode = null;
    let gzipCode = null;
    let loadCode = null;

    const maybeDone = () => {
      if (saveCode === null || gzipCode === null || loadCode === null) return;
      if (settled) return;
      if (saveCode !== 0) fail(new Error("docker save failed"));
      else if (gzipCode !== 0) fail(new Error("gzip compression failed"));
      else if (loadCode !== 0) {
        fail(
          new Error(
            "Image transfer to VPS failed (SSH connection dropped or docker load failed)",
          ),
        );
      } else {
        settled = true;
        resolve();
      }
    };

    save.on("close", (code) => {
      saveCode = code;
      if (code !== 0) {
        killQuietly(gzip);
        killQuietly(load);
      } else if (gzip.stdin.writable) {
        gzip.stdin.end();
      }
      maybeDone();
    });
    gzip.on("close", (code) => {
      gzipCode = code;
      if (code !== 0) {
        killQuietly(save);
        killQuietly(load);
      } else if (load.stdin.writable) {
        load.stdin.end();
      }
      maybeDone();
    });
    load.on("close", (code) => {
      loadCode = code;
      if (code !== 0) {
        killQuietly(save);
        killQuietly(gzip);
      }
      maybeDone();
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function transferOneImage(creds, tag) {
  const user = creds.VPS_USER || "deploy";
  const host = creds.VPS_HOST;
  const loadArgs = [
    "ssh",
    ...sshOptionArgs(creds),
    `${user}@${host}`,
    "gzip -dc | docker load",
  ];
  return runTransfer(["save", tag], loadArgs);
}

export async function transferImagesToHost(creds, imageTags) {
  const tags = [...new Set(imageTags.filter(Boolean))];
  if (tags.length === 0) return;

  const host = creds.VPS_HOST;
  if (!host) throw new Error("VPS_HOST is required for image transfer");

  console.log(
    `[image-transfer] streaming ${tags.length} image(s) to ${host}: ${tags.join(" ")}`,
  );

  for (const tag of tags) {
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt === 1) {
        console.log(
          `[image-transfer] uploading ${tag} (compressed stream — may take several minutes)…`,
        );
      } else {
        console.log(
          `[image-transfer] retry ${attempt}/${MAX_ATTEMPTS} for ${tag}…`,
        );
      }

      try {
        await transferOneImage(creds, tag);
        console.log(`[image-transfer] ${tag} loaded on ${host}`);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS) {
          const delaySec = attempt * 5;
          console.warn(
            `[image-transfer] ${tag} failed: ${err.message}. Retrying in ${delaySec}s…`,
          );
          await sleep(delaySec * 1000);
        }
      }
    }

    if (lastError) throw lastError;
  }
}
