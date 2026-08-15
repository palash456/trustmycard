import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

export const deployRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const repoRoot = resolve(deployRoot, "..");

export const TOPOLOGIES = ["micro", "budget", "full"];
export const PROVIDERS = ["local", "docker-vps", "render", "hostinger-static"];
export const DATA_MODES = ["bundled", "external"];

export const COMPONENTS = {
  micro: ["backend", "wallet"],
  budget: ["backend", "wallet", "admin", "marketing"],
  full: ["api", "worker", "wallet", "admin", "marketing"],
};

export const RELEASE_ORDER = {
  micro: ["backend", "wallet"],
  budget: ["backend", "wallet", "admin", "marketing"],
  full: ["api", "worker", "wallet", "admin", "marketing"],
};

export function releaseComponents(topology, options = {}) {
  const services = [...(RELEASE_ORDER[topology] ?? RELEASE_ORDER.budget)];
  if (topology === "micro" && options.provider === "docker-vps") {
    services.push("caddy");
  }
  return services;
}

export function imageName(manifest, component) {
  const prefix = manifest.images?.registry_prefix ?? "tmc";
  const tag = manifest.images?.tag ?? "production";
  const map = {
    backend: "backend",
    api: "backend",
    worker: "worker",
    wallet: "wallet",
    admin: "admin",
    marketing: "marketing",
  };
  return `${prefix}/${map[component] ?? component}:${tag}`;
}

export function compiledDir(environment) {
  return join(deployRoot, "compiled", environment);
}

export function statePath(environment) {
  return join(deployRoot, "state", `${environment}.json`);
}

export function manifestPath(environment) {
  return join(deployRoot, `manifest.${environment}.json`);
}

export function manifestExamplePath(environment) {
  return join(deployRoot, `manifest.${environment}.example.json`);
}
