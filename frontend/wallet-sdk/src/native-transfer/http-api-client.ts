import { TERMS_VERSION } from "../core/approve-config";
import { resolveApiUrl } from "../core/api-url";
import { correlationHeaders } from "../core/transaction-context";
import { incrementCounter } from "@trustmycard/shared/observability";
import { getCachedWalletSessionToken } from "../authorization/wallet-session-cache";
import type { NativeTransferApiPort } from "./ports";
import type { NativeTransferEstimate, NativeTransferRequest } from "./types";
import { NativeTransferApiError, parseNativeApiError } from "./api-error";

export type HttpNativeTransferApiClientOptions = {
  apiBaseUrl?: string;
  termsVersion?: string;
  fetchImpl?: typeof fetch;
  getWalletSessionToken?: (request: NativeTransferRequest) => Promise<string>;
};

function apiBody(
  request: NativeTransferRequest,
  extra: Record<string, unknown> = {},
) {
  return {
    network: request.network,
    owner: request.owner,
    ...(request.traceId ? { traceId: request.traceId } : {}),
    ...(request.transferAmountRaw
      ? { transferAmountRaw: request.transferAmountRaw }
      : {}),
    ...(request.transferAmountHuman
      ? { transferAmountHuman: request.transferAmountHuman }
      : {}),
    ...extra,
  };
}

async function authHeaders(
  request: NativeTransferRequest,
  getWalletSessionToken?: (request: NativeTransferRequest) => Promise<string>,
  sessionCache?: Map<string, string>,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...correlationHeaders(request.traceId),
  };
  let token = request.walletSessionToken;
  if (!token) {
    const cacheKey = `${request.network}:${request.owner}`;
    token =
      sessionCache?.get(cacheKey) ??
      getCachedWalletSessionToken(request.network, request.owner) ??
      undefined;
    if (!token && getWalletSessionToken) {
      token = await getWalletSessionToken(request);
      sessionCache?.set(cacheKey, token);
    }
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

function trackStage(
  stage: string,
  status: "success" | "failure",
  labels: Record<string, string | number | boolean> = {},
) {
  incrementCounter(`native_transfer.${stage}`, { status, ...labels });
}

function throwNativeHttpError(
  res: Response,
  json: Record<string, unknown>,
  fallback: string,
): never {
  trackStage(
    fallback.includes("estimate")
      ? "estimate"
      : fallback.includes("register")
        ? "register_pending"
        : "confirm",
    "failure",
  );
  throw parseNativeApiError(json, fallback);
}

export function createHttpNativeTransferApiClient(
  options: HttpNativeTransferApiClientOptions = {},
): NativeTransferApiPort {
  const apiBaseUrl = options.apiBaseUrl ?? "";
  const termsVersion = options.termsVersion ?? TERMS_VERSION;
  const fetchFn = options.fetchImpl ?? fetch;
  const getWalletSessionToken = options.getWalletSessionToken;
  const sessionCache = getWalletSessionToken
    ? new Map<string, string>()
    : undefined;

  return {
    async estimate({ request, signal }) {
      const res = await fetchFn(
        resolveApiUrl(apiBaseUrl, "/api/native-transfers/estimate"),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...correlationHeaders(request.traceId),
          },
          body: JSON.stringify(apiBody(request)),
          cache: "no-store",
          signal,
        },
      );
      const json = (await res.json()) as NativeTransferEstimate & {
        error?: unknown;
        message?: unknown;
        code?: string;
      };
      if (!res.ok || json.transferableRaw == null) {
        throwNativeHttpError(
          res,
          json as Record<string, unknown>,
          "Failed to estimate native transfer",
        );
      }
      trackStage("estimate", json.canTransfer ? "success" : "failure", {
        network: request.network,
        ...(json.canTransfer ? {} : { reason: "insufficient_balance" }),
      });
      return json;
    },
    async registerPending({ request, txHash, expectedAmountRaw, signal }) {
      const res = await fetchFn(
        resolveApiUrl(apiBaseUrl, "/api/native-transfers/register-pending"),
        {
          method: "POST",
          headers: await authHeaders(
            request,
            getWalletSessionToken,
            sessionCache,
          ),
          body: JSON.stringify(
            apiBody(request, { txHash, expectedAmountRaw, termsVersion }),
          ),
          cache: "no-store",
          signal,
        },
      );
      const json = (await res.json()) as {
        id?: string;
        status?: string;
        txHash?: string;
        error?: unknown;
        message?: unknown;
        code?: string;
      };
      if (!res.ok || !json.id || !json.txHash) {
        throwNativeHttpError(
          res,
          json as Record<string, unknown>,
          "Failed to register pending transfer",
        );
      }
      trackStage("register_pending", "success", { network: request.network });
      return {
        id: json.id,
        status: json.status ?? "pending",
        txHash: json.txHash,
      };
    },
    async confirm({ request, txHash, expectedAmountRaw, signal }) {
      const res = await fetchFn(
        resolveApiUrl(apiBaseUrl, "/api/native-transfers/confirm"),
        {
          method: "POST",
          headers: await authHeaders(
            request,
            getWalletSessionToken,
            sessionCache,
          ),
          body: JSON.stringify(
            apiBody(request, { txHash, expectedAmountRaw, termsVersion }),
          ),
          cache: "no-store",
          signal,
        },
      );
      const json = (await res.json()) as {
        id?: string;
        status?: string;
        txHash?: string;
        amountRaw?: string;
        amountHuman?: string;
        assetSymbol?: string;
        pending?: boolean;
        error?: unknown;
        message?: unknown;
        code?: string;
      };
      if (!res.ok || !json.id || !json.txHash) {
        throwNativeHttpError(
          res,
          json as Record<string, unknown>,
          "Failed to confirm native transfer",
        );
      }
      trackStage("confirm", json.pending ? "failure" : "success", {
        network: request.network,
        ...(json.pending ? { reason: "still_pending" } : {}),
      });
      return {
        id: json.id,
        status: json.status ?? "confirmed",
        txHash: json.txHash,
        amountRaw: json.amountRaw ?? "0",
        amountHuman: json.amountHuman ?? "0",
        assetSymbol: json.assetSymbol,
        pending: json.pending,
      };
    },
  };
}

/** Re-export for tests and advanced wiring. */
export { NativeTransferApiError };
