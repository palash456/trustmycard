/** Cloudflare Access / reverse-proxy identity header (optional). */
export function resolveAdminActor(req: Request): string {
  const configured = process.env.ADMIN_IDENTITY_HEADER?.trim();
  if (configured) {
    const value = req.headers.get(configured)?.trim();
    if (value) return value;
  }
  const forwarded = req.headers.get("x-admin-actor")?.trim();
  if (forwarded) return forwarded;
  return "panel-operator";
}
