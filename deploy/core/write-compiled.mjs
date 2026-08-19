import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { compiledDir } from "./types.mjs";

function serializeEnv(map) {
  const encodeForDockerEnv = (value) => {
    const s = String(value ?? "");
    // Docker env files treat '&' specially; percent-encode so URLs stay unquoted.
    return s.replace(/&/g, "%26");
  };
  return (
    Object.entries(map)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, value]) => `${key}=${encodeForDockerEnv(value)}`)
      .join("\n") + "\n"
  );
}

export function writeCompiledEnv(environment, bundles, caddyfile) {
  const dir = compiledDir(environment);
  mkdirSync(dir, { recursive: true });
  const paths = {};
  for (const [name, env] of Object.entries(bundles)) {
    const file = join(dir, `${name}.env`);
    writeFileSync(file, serializeEnv(env), "utf8");
    paths[name] = file;
  }
  if (caddyfile) {
    const file = join(dir, "Caddyfile");
    writeFileSync(file, caddyfile, "utf8");
    paths.caddy = file;
  }
  return paths;
}
