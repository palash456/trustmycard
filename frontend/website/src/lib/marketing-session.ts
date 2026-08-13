export {
  MARKETING_SESSION_COOKIE,
  LEGACY_AD_ACCESS_COOKIE,
  createMarketingSessionToken,
  verifyMarketingSessionToken,
  marketingSessionCookieOptions,
  clearLegacyAdAccessCookie,
} from "./marketing/session";
export {
  DEFAULT_MARKETING_SESSION_TTL_MINUTES,
  getMarketingSessionTtlMs,
} from "./marketing/session-config";
