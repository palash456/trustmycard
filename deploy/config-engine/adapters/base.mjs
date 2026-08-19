export function assertConfigAdapter(adapter) {
  if (!adapter?.releaseConfigOnly)
    throw new Error("Config adapter must implement releaseConfigOnly(ctx)");
  return adapter;
}
