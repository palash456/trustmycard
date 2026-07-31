import { createHttpApprovalApiClient } from "../approval/http-api-client";
import type { ApprovalApiPort } from "../approval/ports";
import type { ApprovalRequest, PreparedApproval } from "../approval/types";
import { meetsExpectedAllowance } from "../core/evm-approve-guard";
import type { AuthorizationAssetResult, TokenSymbol } from "../types";
import type { IncludedAssetWorkItem } from "./preferences";

export { meetsExpectedAllowance };

export type AllowancePreflightResult = {
  prepared: PreparedApproval;
  alreadyAuthorized: boolean;
};

export async function preflightExistingAllowance(args: {
  api: ApprovalApiPort;
  request: ApprovalRequest;
  signal?: AbortSignal;
}): Promise<AllowancePreflightResult> {
  const prepared = await args.api.prepare({
    request: args.request,
    signal: args.signal,
  });
  const verified = await args.api.verifyAllowance({
    request: args.request,
    prepared,
    signal: args.signal,
  });
  return {
    prepared,
    alreadyAuthorized: meetsExpectedAllowance(verified, prepared),
  };
}

export function alreadyAuthorizedResult(args: {
  item: IncludedAssetWorkItem & { asset: TokenSymbol };
}): AuthorizationAssetResult {
  return {
    network: args.item.network,
    token: args.item.asset,
    outcome: "authorized",
    message: "Already authorized — sufficient allowance on-chain",
    transferSkippedReason: "already_authorized",
  };
}

export function createPreflightApi(apiBaseUrl?: string): ApprovalApiPort {
  return createHttpApprovalApiClient({ apiBaseUrl });
}
