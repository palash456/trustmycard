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

function requiredAllowanceRaw(
  request: ApprovalRequest,
  prepared: PreparedApproval,
): bigint {
  const transferAmount = request.transferAmountRaw?.trim();
  if (request.executeTransfer && transferAmount) {
    try {
      const parsed = BigInt(transferAmount);
      if (parsed > BigInt(0)) return parsed;
    } catch {
      /* fall back to prepared approval amount */
    }
  }
  if (prepared.unlimited) return BigInt(1);
  return BigInt(prepared.amountRaw);
}

export function meetsRequiredAllowance(args: {
  request: ApprovalRequest;
  prepared: PreparedApproval;
  verified: { hasAllowance: boolean; allowance: string };
}): boolean {
  if (!args.verified.hasAllowance) return false;
  return (
    BigInt(args.verified.allowance) >=
    requiredAllowanceRaw(args.request, args.prepared)
  );
}

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
    alreadyAuthorized: meetsRequiredAllowance({
      request: args.request,
      prepared,
      verified,
    }),
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
