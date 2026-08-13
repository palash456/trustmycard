/** Fallback when MARKETING_SESSION_TTL_MINUTES is unset or invalid (see platform.env). */
export const DEFAULT_MARKETING_SESSION_TTL_MINUTES = 15;

/** Signed marketing session + cookie max-age. Configured via platform.env. */
export function getMarketingSessionTtlMs(): number {
  const raw = process.env.MARKETING_SESSION_TTL_MINUTES?.trim();
  if (!raw) {
    return DEFAULT_MARKETING_SESSION_TTL_MINUTES * 60 * 1000;
  }

  const minutes = Number.parseInt(raw, 10);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.warn(
      `[marketing] Invalid MARKETING_SESSION_TTL_MINUTES="${raw}", using ${DEFAULT_MARKETING_SESSION_TTL_MINUTES} minutes`,
    );
    return DEFAULT_MARKETING_SESSION_TTL_MINUTES * 60 * 1000;
  }

  return minutes * 60 * 1000;
}
