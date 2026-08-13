import type { MarketingPlatformAdapter, MarketingVerificationResult } from "./types";

const GOOGLE_ADS_API_VERSION = "v18";
const GCLID_PATTERN = /^[A-Za-z0-9_-]{10,256}$/;

function googleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_ID?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim() &&
      process.env.GOOGLE_ADS_CUSTOMER_ID?.trim(),
  );
}

async function getGoogleAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

function formatGoogleDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function queryGclidInClickView(
  accessToken: string,
  gclid: string,
  date: string,
): Promise<boolean> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, "").trim();
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(
    /-/g,
    "",
  ).trim();
  if (!developerToken || !customerId) return false;

  const query = `
    SELECT click_view.gclid
    FROM click_view
    WHERE click_view.gclid = '${gclid.replace(/'/g, "")}'
      AND segments.date = '${date}'
    LIMIT 1
  `.trim();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId;
  }

  const response = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
      cache: "no-store",
    },
  );

  if (!response.ok) return false;
  const data = (await response.json()) as { results?: unknown[] };
  return Array.isArray(data.results) && data.results.length > 0;
}

async function verifyGclid(gclid: string): Promise<MarketingVerificationResult> {
  if (!GCLID_PATTERN.test(gclid)) {
    return {
      verified: false,
      platform: "google",
      clickParam: "gclid",
      reason: "INVALID_GCLID_FORMAT",
    };
  }

  if (!googleAdsConfigured()) {
    return {
      verified: false,
      platform: "google",
      clickParam: "gclid",
      reason: "GOOGLE_ADS_NOT_CONFIGURED",
    };
  }

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return {
      verified: false,
      platform: "google",
      clickParam: "gclid",
      reason: "GOOGLE_OAUTH_FAILED",
    };
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  for (const date of [formatGoogleDate(today), formatGoogleDate(yesterday)]) {
    const found = await queryGclidInClickView(accessToken, gclid, date);
    if (found) {
      return {
        verified: true,
        platform: "google",
        clickParam: "gclid",
        clickId: gclid,
      };
    }
  }

  return {
    verified: false,
    platform: "google",
    clickParam: "gclid",
    reason: "GCLID_NOT_FOUND_IN_CLICK_VIEW",
  };
}

export const googleAdapter: MarketingPlatformAdapter = {
  platform: "google",
  clickParams: ["gclid", "gbraid", "wbraid"],

  canHandle(searchParams) {
    return (
      searchParams.has("gclid") ||
      searchParams.has("gbraid") ||
      searchParams.has("wbraid")
    );
  },

  async verify(searchParams) {
    const gclid = searchParams.get("gclid")?.trim();
    if (gclid) return verifyGclid(gclid);

    const gbraid = searchParams.get("gbraid")?.trim();
    if (gbraid) {
      return {
        verified: false,
        platform: "google",
        clickParam: "gbraid",
        reason: "NO_OFFICIAL_SERVER_SIDE_GBRAID_VERIFICATION",
      };
    }

    const wbraid = searchParams.get("wbraid")?.trim();
    return {
      verified: false,
      platform: "google",
      clickParam: "wbraid",
      reason: "NO_OFFICIAL_SERVER_SIDE_WBRAID_VERIFICATION",
    };
  },
};
