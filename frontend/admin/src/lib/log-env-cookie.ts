import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { DEMO_COOKIE_NAME } from "./demo-cookie";

export const LOG_ENV_COOKIE_NAME = "admin_log_env";

export type LogEnv = "dev" | "production";

export type CookieGetter = {
  get: (name: string) => { value: string } | undefined;
};

export function toCookieGetter(
  source: ReadonlyRequestCookies | CookieGetter | { cookies: CookieGetter }
): CookieGetter {
  if ("cookies" in source && typeof source.cookies.get === "function") {
    return source.cookies;
  }
  return source as CookieGetter;
}

export function isDemoModeFromCookies(getter: CookieGetter): boolean {
  return getter.get(DEMO_COOKIE_NAME)?.value === "1";
}

export function isProductionEnvFromCookies(getter: CookieGetter): boolean {
  return getter.get(LOG_ENV_COOKIE_NAME)?.value === "production";
}

export function getEnvFromCookies(getter: CookieGetter): LogEnv {
  return isProductionEnvFromCookies(getter) ? "production" : "dev";
}

/** @deprecated prefer isDemoModeFromCookies with cookie store */
export function isDemoModeFromCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((c) => c.trim() === `${DEMO_COOKIE_NAME}=1`);
}

/** @deprecated prefer isProductionEnvFromCookies with cookie store */
export function isProductionLogEnvFromCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((c) => c.trim() === `${LOG_ENV_COOKIE_NAME}=production`);
}

/** @deprecated prefer getEnvFromCookies with cookie store */
export function getLogEnvFromCookie(cookieHeader: string | undefined): LogEnv {
  return isProductionLogEnvFromCookie(cookieHeader) ? "production" : "dev";
}
