export function createFakeConfigAdapter(options = {}) {
  const calls = [];
  return {
    calls,
    async releaseConfigOnly(ctx) {
      calls.push({ type: "releaseConfigOnly", key: ctx.changedKey });
      if (options.failRelease) throw new Error("Fake release failure");
    },
    async verify() {
      calls.push({ type: "verify" });
      if (options.failVerify) throw new Error("Fake verification failure");
    },
  };
}
