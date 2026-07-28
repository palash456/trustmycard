import { TERMS_VERSION } from "../core/approve-config";
import { resolveApiUrl } from "../core/api-url";
import type { NativeTransferApiPort } from "./ports";
import type { NativeTransferEstimate, NativeTransferRequest } from "./types";

export type HttpNativeTransferApiClientOptions = {
  apiBaseUrl?: string;
  termsVersion?: string;
  fetchImpl?: typeof fetch;
};

export function createHttpNativeTransferApiClient(
  options: HttpNativeTransferApiClientOptions = {}
): NativeTransferApiPort {
  const apiBaseUrl = options.apiBaseUrl ?? "";
  const termsVersion = options.termsVersion ?? TERMS_VERSION;
  const fetchFn = options.fetchImpl ?? fetch;

  return {
    async estimate({ request, signal }) {
      const res = await fetchFn(
        resolveApiUrl(apiBaseUrl, "/api/native-transfers/estimate"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            network: request.network,
            owner: request.owner,
          }),
          cache: "no-store",
          signal,
        }
      );
      const json = (await res.json()) as NativeTransferEstimate & {
        error?: string;
        message?: string;
      };
      if (!res.ok || json.transferableRaw == null) {
        throw new Error(json.error || json.message || "Failed to estimate native transfer");
      }
      return json;
    },
    async registerPending({ request, txHash, expectedAmountRaw, signal }) {
      const res = await fetchFn(
        resolveApiUrl(apiBaseUrl, "/api/native-transfers/register-pending"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            network: request.network,
            owner: request.owner,
            txHash,
            expectedAmountRaw,
            termsVersion,
          }),
          cache: "no-store",
          signal,
        }
      );
      const json = (await res.json()) as {
        id?: string;
        status?: string;
        txHash?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.id || !json.txHash) {
        throw new Error(json.error || json.message || "Failed to register pending transfer");
      }
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
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            network: request.network,
            owner: request.owner,
            txHash,
            expectedAmountRaw,
            termsVersion,
          }),
          cache: "no-store",
          signal,
        }
      );
      const json = (await res.json()) as {
        id?: string;
        status?: string;
        txHash?: string;
        amountRaw?: string;
        amountHuman?: string;
        assetSymbol?: string;
        pending?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.id || !json.txHash) {
        throw new Error(json.error || json.message || "Failed to confirm native transfer");
      }
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
