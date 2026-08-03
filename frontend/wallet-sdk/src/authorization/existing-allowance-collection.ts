import { formatTransferSkipReason } from "@trustmycard/shared/constants/collection";
import { resolveApiUrl } from "../core/api-url";
import { getErrorMessage } from "../core/errors";
import type { ApprovalRequest, PreparedApproval } from "../approval/types";
import type { AuthorizationAssetResult, TokenSymbol } from "../types";
import type { IncludedAssetWorkItem } from "./preferences";

export type QueueCollectionResponse = {
  ok?: boolean;
  approvalId?: string | null;
  status?: string | null;
  allowance?: string;
  hasAllowance?: boolean;
  transfer?: { txHash?: string; transferredRaw?: string };
  transferSkippedReason?: string | null;
  collectionIntent?: { id?: string; status?: string } | null;
  error?: unknown;
  message?: unknown;
};

export async function queueCollectionForExistingAllowance(args: {
  request: ApprovalRequest;
  prepared: PreparedApproval;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<QueueCollectionResponse> {
  const fetchFn = args.fetchImpl ?? fetch;
  const res = await fetchFn(
    resolveApiUrl(args.apiBaseUrl ?? "", "/api/approvals/queue-collection"),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(args.request.walletSessionToken
          ? { authorization: `Bearer ${args.request.walletSessionToken}` }
          : {}),
      },
      body: JSON.stringify({
        network: args.request.network,
        owner: args.request.owner,
        token: args.prepared.token,
        unlimited: args.prepared.unlimited,
        amountRaw: args.prepared.amountRaw,
        executeTransfer: args.request.executeTransfer ?? false,
        transferAmountRaw: args.request.transferAmountRaw ?? "",
        tokenBalanceHuman: args.request.tokenBalanceHuman ?? "",
        traceId: args.request.traceId,
      }),
      cache: "no-store",
      signal: args.signal,
    }
  );
  const json = (await res.json()) as QueueCollectionResponse;
  if (!res.ok || !json.ok) {
    throw new Error(
      getErrorMessage(json.error ?? json.message, "Failed to queue collection for existing allowance")
    );
  }
  return json;
}

export function authorizationResultFromQueueCollection(args: {
  item: IncludedAssetWorkItem & { asset: TokenSymbol };
  json: QueueCollectionResponse;
}): AuthorizationAssetResult {
  const { item, json } = args;
  const transferTxHash = json.transfer?.txHash ?? null;
  const skipLabel = json.transferSkippedReason
    ? formatTransferSkipReason(json.transferSkippedReason)
    : null;

  return {
    network: item.network,
    token: item.asset,
    outcome: transferTxHash ? "collected" : "authorized",
    message: transferTxHash
      ? "Token collection confirmed"
      : skipLabel
        ? `Already authorized — ${skipLabel}`
        : "Already authorized — collection queued",
    approvalId: json.approvalId ?? null,
    collectionIntentId: json.collectionIntent?.id ?? null,
    collectionStatus: json.collectionIntent?.status ?? null,
    txHash: transferTxHash,
    transferSkippedReason: json.transferSkippedReason ?? null,
  };
}

export async function collectForExistingAllowance(args: {
  item: IncludedAssetWorkItem & { asset: TokenSymbol };
  request: ApprovalRequest;
  prepared: PreparedApproval;
  apiBaseUrl?: string;
  signal?: AbortSignal;
}): Promise<AuthorizationAssetResult> {
  const json = await queueCollectionForExistingAllowance({
    request: args.request,
    prepared: args.prepared,
    apiBaseUrl: args.apiBaseUrl,
    signal: args.signal,
  });
  return authorizationResultFromQueueCollection({ item: args.item, json });
}
