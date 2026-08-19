/**
 * Server-only site identity config — used by API route handlers (security.txt etc.).
 * Do NOT import this in client components; use process.env.NEXT_PUBLIC_* directly there.
 */
export function sitePublicConfig() {
  const legalName = process.env.NEXT_PUBLIC_LEGAL_NAME?.trim() ?? "";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";
  // PLATFORM_SECURITY_EMAIL is server-only (no NEXT_PUBLIC_ prefix).
  const securityEmail =
    process.env.PLATFORM_SECURITY_EMAIL?.trim() || supportEmail || "";
  const websiteDomain =
    process.env.NEXT_PUBLIC_WEBSITE_DOMAIN?.trim() ||
    (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "").hostname;
      } catch {
        return "";
      }
    })();

  return { legalName, supportEmail, securityEmail, websiteDomain };
}
