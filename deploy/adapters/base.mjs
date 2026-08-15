import { localAdapter } from "./local.mjs";
import { dockerVpsAdapter } from "./docker-vps.mjs";
import { renderAdapter } from "./render.mjs";
import { hostingerStaticAdapter } from "./hostinger-static.mjs";

const adapters = {
  local: localAdapter,
  "docker-vps": dockerVpsAdapter,
  render: renderAdapter,
  "hostinger-static": hostingerStaticAdapter,
};

export function getAdapter(name) {
  const adapter = adapters[name];
  if (!adapter) {
    throw new Error(`Unknown deploy provider "${name}"`);
  }
  return adapter;
}

export function listAdapters() {
  return Object.keys(adapters);
}
