export type MarketingVerificationSuccess = {
  verified: true;
  platform: string;
  clickParam: string;
  clickId: string;
};

export type MarketingVerificationFailure = {
  verified: false;
  platform: string;
  clickParam: string;
  reason: string;
};

export type MarketingVerificationResult =
  | MarketingVerificationSuccess
  | MarketingVerificationFailure;

export interface MarketingPlatformAdapter {
  readonly platform: string;
  readonly clickParams: readonly string[];
  canHandle(searchParams: URLSearchParams): boolean;
  verify(searchParams: URLSearchParams): Promise<MarketingVerificationResult>;
}
