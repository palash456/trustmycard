/** VS Code task terminals often lack a TTY; carriage-return progress garbles output. */
export function applyNonTtyDefaults() {
  if (process.stdout.isTTY) return;
  process.env.BUILDKIT_PROGRESS ??= "plain";
  process.env.CI ??= "true";
  process.env.FORCE_COLOR ??= "0";
  process.env.DOCKER_BUILDKIT ??= "1";
}
