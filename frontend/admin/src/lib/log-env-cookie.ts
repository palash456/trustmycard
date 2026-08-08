export const LOG_ENV_COOKIE_NAME = "admin_log_env";

export type LogEnv = "dev" | "production";

export function isProductionLogEnvFromCookie(
  cookieHeader: string | undefined
): boolean {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(";")
    .some((c) => c.trim() === `${LOG_ENV_COOKIE_NAME}=production`);
}

export function getLogEnvFromCookie(cookieHeader: string | undefined): LogEnv {
  return isProductionLogEnvFromCookie(cookieHeader) ? "production" : "dev";
}
