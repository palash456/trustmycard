export type EligibilityAssetType = "native" | "usdt" | "usdc";

export type AssetEligibilityState = "ELIGIBLE" | "INELIGIBLE" | "UNKNOWN";

export type AssetEligibilityReason =
  "MEETS_MINIMUM" | "BELOW_MINIMUM" | "BALANCE_UNAVAILABLE" | "INVALID_BALANCE";

export type AssetEligibility = {
  networkKey: string;
  assetType: EligibilityAssetType;
  symbol: string;
  contractAddress: string | null;
  balance: string;
  minimumBalance: string;
  balanceBaseUnits: bigint;
  minimumBaseUnits: bigint;
  state: AssetEligibilityState;
  eligible: boolean;
  reason: AssetEligibilityReason;
};

export type NetworkEligibilityStatus =
  "ELIGIBLE" | "PARTIALLY_ELIGIBLE" | "INELIGIBLE" | "CHECK_FAILED";

export type NetworkEligibilityResult = {
  networkKey: string;
  status: NetworkEligibilityStatus;
  assets: AssetEligibility[];
  /** Combined copy for logs and backwards compatibility. */
  message: string;
  headline: string;
  detail: string;
};
