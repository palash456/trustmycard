import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { compiledDir } from "./types.mjs";

function serializeEnv(map) {
  return (
    Object.entries(map)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, value]) => `${key}=${String(value ?? "")}`)
      .join("\n") + "\n"
  );
}

export function writeCompiledEnv(environment, bundles) {
  const dir = compiledDir(environment);
  mkdirSync(dir, { recursive: true });
  const paths = {};
  for (const [name, env] of Object.entries(bundles)) {
    const file = join(dir, `${name}.env`);
    writeFileSync(file, serializeEnv(env), "utf8");
    paths[name] = file;
  }
  return paths;
}
