import { createRequire } from "module";
import { resolve } from "path";

const nodeRequire = createRequire(__filename);
const { loadTmcEnv } = nodeRequire(
  resolve(__dirname, "../../../config/load-env.mjs")
) as { loadTmcEnv: (app: "backend" | "website" | "admin") => string };

const tmcEnv = loadTmcEnv("backend");
console.log(`[trustmycard] TMC_ENV=${tmcEnv}`);
