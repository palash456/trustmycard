import { googleAdapter } from "./google";
import { linkedinAdapter } from "./linkedin";
import { metaAdapter } from "./meta";
import { tiktokAdapter } from "./tiktok";
import type {
  MarketingPlatformAdapter,
  MarketingVerificationResult,
} from "./types";

const ADAPTERS: MarketingPlatformAdapter[] = [
  googleAdapter,
  metaAdapter,
  tiktokAdapter,
  linkedinAdapter,
];

export function listMarketingAdapters(): readonly MarketingPlatformAdapter[] {
  return ADAPTERS;
}

export async function verifyMarketingClick(
  searchParams: URLSearchParams,
): Promise<MarketingVerificationResult> {
  for (const adapter of ADAPTERS) {
    if (!adapter.canHandle(searchParams)) continue;
    return adapter.verify(searchParams);
  }

  return {
    verified: false,
    platform: "unknown",
    clickParam: "none",
    reason: "NO_SUPPORTED_CLICK_IDENTIFIER",
  };
}
