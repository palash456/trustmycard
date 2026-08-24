import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import { join } from "path";
import { createRequire } from "module";
import { deployRoot, imageName, repoRoot } from "./types.mjs";

const require = createRequire(import.meta.url);
const { eligibilityEnvVarNames } = require(
  join(repoRoot, "config/eligibility-env.mjs"),
);

const DOCKERFILES = {
  backend: "Dockerfile.backend",
  worker: "Dockerfile.worker",
  wallet: "Dockerfile.wallet",
  admin: "Dockerfile.admin",
  marketing: "Dockerfile.marketing",
};

function parseEnvFile(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const eq = t.indexOf("=");
      out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  } catch {
    // optional
  }
  return out;
}

function buildArgsFor(component, ctx) {
  const envPath = join(
    deployRoot,
    "compiled",
    ctx.environment,
    `${component}.env`,
  );
  const env = parseEnvFile(envPath);
  const args = [];
  const keys =
    component === "wallet"
      ? [
          "NEXT_PUBLIC_APP_URL",
          "NEXT_PUBLIC_PROJECT_ID",
          ...eligibilityEnvVarNames(),
        ]
      : component === "marketing"
        ? ["NEXT_PUBLIC_APP_URL"]
        : [];
  for (const key of keys) {
    if (env[key]) args.push("--build-arg", `${key}=${env[key]}`);
  }
  return args;
}

export function buildImages(ctx) {
  const { manifest, topology } = ctx;
  const components =
    topology === "full"
      ? ["backend", "worker", "wallet", "admin", "marketing"]
      : topology === "micro"
        ? ["backend", "wallet"]
        : ["backend", "wallet", "admin", "marketing"];

  const built = {};
  for (const component of components) {
    const dockerfile = join(deployRoot, "docker", DOCKERFILES[component]);
    const tag = imageName(manifest, component);
    console.log(`[build] docker build ${component} -> ${tag}`);
    const result = spawnSync(
      "docker",
      [
        "build",
        "-f",
        dockerfile,
        "-t",
        tag,
        "--label",
        `tmc.component=${component}`,
        ...buildArgsFor(component, ctx),
        repoRoot,
      ],
      {
        stdio: "inherit",
        env: { ...process.env, DOCKER_BUILDKIT: "1" },
      },
    );
    if (result.status !== 0) {
      throw new Error(`Docker build failed for ${component}`);
    }
    built[component] = tag;
  }
  return built;
}
