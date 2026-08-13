import type { MarketingPlatformAdapter } from "./types";

/**
 * Meta does not provide an official inbound fbclid verification API.
 * Access is granted when a valid-looking fbclid arrives on `/` (homepage attestation
 * required at the verify step) and passes through the one-time token exchange.
 *
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api
 */
export const FBCLID_PATTERN = /^[A-Za-z0-9_-]{20,512}$/;

export function isValidLookingFbclid(value: string | null | undefined): boolean {
  const fbclid = value?.trim();
  if (!fbclid) return false;
  return FBCLID_PATTERN.test(fbclid);
}

export const metaAdapter: MarketingPlatformAdapter = {
  platform: "meta",
  clickParams: ["fbclid"],

  canHandle(searchParams) {
    return searchParams.has("fbclid");
  },

  async verify(searchParams) {
    const fbclid = searchParams.get("fbclid")?.trim() ?? "";

    if (!isValidLookingFbclid(fbclid)) {
      return {
        verified: false,
        platform: "meta",
        clickParam: "fbclid",
        reason: fbclid ? "INVALID_FBCLID_FORMAT" : "MISSING_FBCLID",
      };
    }

    return {
      verified: true,
      platform: "meta",
      clickParam: "fbclid",
      clickId: fbclid,
    };
  },
};
