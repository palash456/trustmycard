process.env.TS_NODE_PROJECT =
  process.env.TS_NODE_PROJECT ||
  require("path").join(__dirname, "..", "tsconfig.test.json");
require("ts-node/register/transpile-only");
