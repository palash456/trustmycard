export function createConfigDeployAdapter({
  failRelease = false,
  failVerify = false,
} = {}) {
  const calls = [];
  return {
    calls,
    async releaseConfigOnly(ctx) {
      calls.push({ method: "releaseConfigOnly", key: ctx.changedKey });
      if (failRelease) throw new Error("release failure");
    },
    async verify() {
      calls.push({ method: "verify" });
      if (failVerify) throw new Error("verify failure");
    },
  };
}
