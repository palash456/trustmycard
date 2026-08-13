import type { MarketingPlatformAdapter } from "./types";

/**
 * TikTok documents Events API for sending events to TikTok, not for verifying
 * that a ttclid represents a genuine ad click. Fail closed.
 * @see https://business-api.tiktok.com/portal/docs?id=1771100865818625
 */
export const tiktokAdapter: MarketingPlatformAdapter = {
  platform: "tiktok",
  clickParams: ["ttclid"],

  canHandle(searchParams) {
    return searchParams.has("ttclid");
  },

  async verify(searchParams) {
    return {
      verified: false,
      platform: "tiktok",
      clickParam: "ttclid",
      reason: searchParams.get("ttclid")?.trim()
        ? "NO_OFFICIAL_TTCLID_VERIFICATION_API"
        : "MISSING_TTCLID",
    };
  },
};
