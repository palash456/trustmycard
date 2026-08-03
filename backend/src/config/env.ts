import { createRequire } from "module";
import { resolve } from "path";

const require = createRequire(__filename);
const { loadTmcEnv } = require(
  resolve(__dirname, "../../../config/load-env.mjs")
) as { loadTmcEnv: (app: "backend" | "website" | "admin") => string };

const tmcEnv = loadTmcEnv("backend");
console.log(`[trustmycard] TMC_ENV=${tmcEnv}`);
