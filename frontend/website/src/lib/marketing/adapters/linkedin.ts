import type { MarketingPlatformAdapter } from "./types";

/**
 * LinkedIn documents Conversions API for streaming conversion events, not for
 * verifying that li_fat_id represents a genuine ad click. Fail closed.
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/conversions-api
 */
export const linkedinAdapter: MarketingPlatformAdapter = {
  platform: "linkedin",
  clickParams: ["li_fat_id"],

  canHandle(searchParams) {
    return searchParams.has("li_fat_id");
  },

  async verify(searchParams) {
    return {
      verified: false,
      platform: "linkedin",
      clickParam: "li_fat_id",
      reason: searchParams.get("li_fat_id")?.trim()
        ? "NO_OFFICIAL_LI_FAT_ID_VERIFICATION_API"
        : "MISSING_LI_FAT_ID",
    };
  },
};
