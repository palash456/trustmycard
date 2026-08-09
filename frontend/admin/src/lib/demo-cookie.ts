export function isDemoModeFromCookie(
  cookieHeader: string | undefined,
): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((c) => c.trim() === "admin_demo_mode=1");
}

export const DEMO_COOKIE_NAME = "admin_demo_mode";
