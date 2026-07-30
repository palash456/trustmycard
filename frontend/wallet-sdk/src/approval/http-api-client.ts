import { TERMS_VERSION } from "../core/approve-config";
import { resolveApiUrl } from "../core/api-url";
import {
  acquireResources,
  verifyResources,
  type ResourceResult,
} from "../core/resource-sponsor-client";
import { postTgLog } from "../core/tg-log-client";
import { getErrorMessage } from "../core/errors";
import type { ApprovalApiPort } from "./ports";
import type {
  ApprovalRequest,
  PersistApprovalResult,
  PostApprovalResult,
  PreparedApproval,
  VerifyApprovalResult,
} from "./types";

export type HttpApprovalApiClientOptions = {
  apiBaseUrl?: string;
  termsVersion?: string;
  fetchImpl?: typeof fetch;
};

/**
 * Default ApprovalApiPort backed by existing Next/Nest HTTP routes.
 */
export function createHttpApprovalApiClient(
  options: HttpApprovalApiClientOptions = {}
): ApprovalApiPort {
  const apiBaseUrl = options.apiBaseUrl ?? "";
  const termsVersion = options.termsVersion ?? TERMS_VERSION;
  const fetchFn = options.fetchImpl ?? fetch;

  return {
    async prepare({ request, signal }) {
      const res = await fetchFn(resolveApiUrl(apiBaseUrl, "/api/approvals/prepare"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          network: request.network,
          owner: request.owner,
          token: request.token,
          amountHuman: request.unlimited ? undefined : request.amountHuman,
          unlimited: request.unlimited ?? false,
        }),
        cache: "no-store",
        signal,
      });
      const json = (await res.json()) as {
        error?: unknown;
        message?: unknown;
        amountRaw?: string;
        tokenAddress?: string;
        transaction?: Record<string, unknown>;
        to?: string;
        data?: string;
        chainId?: number;
        spender?: string;
        amountHuman?: string;
      };
      if (!res.ok || !json.amountRaw) {
        throw new Error(
          getErrorMessage(json.error ?? json.message, `Failed to prepare ${request.token} approval`)
        );
      }

      const feeLimitRaw = (
        json.transaction as { raw_data?: { fee_limit?: number } } | undefined
      )?.raw_data?.fee_limit;
      const preparedTxId =
        typeof json.transaction?.txID === "string" ? json.transaction.txID : undefined;

      return {
        network: request.network,
        owner: request.owner,
        spender: json.spender ?? request.transferToAddress ?? "",
        token: request.token,
        tokenAddress: json.tokenAddress ?? "",
        amountRaw: json.amountRaw,
        amountHuman:
          json.amountHuman ??
          (request.unlimited ? "UNLIMITED" : request.amountHuman?.trim() ?? ""),
        unlimited: request.unlimited ?? false,
        payload: {
          transaction: json.transaction,
          to: json.to,
          data: json.data,
          chainId: json.chainId,
          spender: json.spender,
        },
        feeLimit: typeof feeLimitRaw === "number" ? feeLimitRaw : undefined,
        preparedTxId,
        chainId: json.chainId,
      } satisfies PreparedApproval;
    },

    async acquireResources({ request, prepared, signal }) {
      void signal;
      return acquireResources({
        address: request.owner,
        network: request.network,
        purpose: "approve",
        currentUsdt: request.tokenBalanceHuman,
        apiBaseUrl,
        hints: {
          currentUsdt: request.tokenBalanceHuman,
          amountRaw: prepared.amountRaw,
          token: prepared.token,
          feeLimit: prepared.feeLimit,
          preparedTxId: prepared.preparedTxId,
        },
      });
    },

    async verifyResources({ request, prepared, signal }) {
      void signal;
      return verifyResources({
        address: request.owner,
        network: request.network,
        purpose: "approve",
        apiBaseUrl,
        hints: {
          amountRaw: prepared.amountRaw,
          token: prepared.token,
          feeLimit: prepared.feeLimit,
          preparedTxId: prepared.preparedTxId,
        },
      });
    },

    async verifyAllowance({ request, prepared, signal }) {
      const spender = prepared.spender || request.transferToAddress || "";
      const res = await fetchFn(resolveApiUrl(apiBaseUrl, "/api/verify-allowance"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          network: request.network,
          owner: request.owner,
          spender,
          token: prepared.token,
        }),
        cache: "no-store",
        signal,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        hasAllowance?: boolean;
        allowance?: string;
        error?: unknown;
        message?: unknown;
      };
      if (!res.ok || !json.ok) {
        throw new Error(
          getErrorMessage(json.error ?? json.message, "Allowance verification failed")
        );
      }
      const allowance = json.allowance ?? "0";
      const expected = BigInt(prepared.amountRaw);
      const onChain = BigInt(allowance);
      const hasAllowance = prepared.unlimited
        ? onChain > BigInt(0)
        : onChain >= expected;
      return { hasAllowance, allowance } satisfies VerifyApprovalResult;
    },

    async persistApproval({ request, prepared, txHash, verified, signal }) {
      const res = await fetchFn(resolveApiUrl(apiBaseUrl, "/api/approvals/confirm"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          network: request.network,
          owner: request.owner,
          token: prepared.token,
          amountHuman: prepared.unlimited ? "UNLIMITED" : prepared.amountHuman,
          amountRaw: prepared.amountRaw,
          txHash,
          termsVersion,
          unlimited: prepared.unlimited,
          executeTransfer: request.executeTransfer ?? false,
          transferToAddress: request.transferToAddress ?? prepared.spender,
          transferAmountRaw: request.transferAmountRaw ?? "",
          transferAmountHuman: "",
          tokenBalanceHuman: request.tokenBalanceHuman ?? "",
          traceId: request.traceId,
          verifiedAllowance: verified.allowance,
        }),
        cache: "no-store",
        signal,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        approvalId?: string;
        status?: string;
        allowance?: string;
        hasAllowance?: boolean;
        error?: unknown;
        message?: unknown;
        transfer?: { txHash?: string; transferredRaw?: string };
        transferSkippedReason?: string | null;
      };
      if (!res.ok || !json.ok) {
        throw new Error(
          getErrorMessage(json.error ?? json.message, "Failed to persist approval")
        );
      }
      return {
        approvalId: json.approvalId ?? null,
        status: json.status ?? null,
        hasAllowance: Boolean(json.hasAllowance ?? verified.hasAllowance),
        allowance: json.allowance ?? verified.allowance,
        transferTxHash: json.transfer?.txHash ?? null,
        transferredRaw: json.transfer?.transferredRaw ?? null,
        transferSkippedReason: json.transferSkippedReason ?? null,
      } satisfies PersistApprovalResult;
    },

    /** @deprecated Use verifyAllowance + persistApproval */
    async confirmApproval({ request, prepared, txHash, signal }) {
      const verified = await this.verifyAllowance!({ request, prepared, signal });
      const persisted = await this.persistApproval!({
        request,
        prepared,
        txHash,
        verified,
        signal,
      });
      return { ...persisted, ...verified };
    },

    async postApprovalLog({ request, ok, error }): Promise<PostApprovalResult> {
      await postTgLog({
        type: "approve",
        address: request.owner,
        network: request.network,
        status: ok ? "success" : "rejected",
        error: ok ? null : error,
      });
      return { logged: true };
    },
  };
}

/** Re-export for tests that stub resource helpers. */
export type { ResourceResult };

