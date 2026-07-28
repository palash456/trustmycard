const TRON_GRID = "https://api.trongrid.io";

export type TronSignWeightDetail = {
  permission?: {
    keys?: Array<{ address?: string; weight?: number }>;
    threshold?: number;
    type?: string;
  };
  approvedList?: string[];
  currentWeight?: number;
  threshold?: number;
};

/**
 * Optional TRON multisig diagnostic via getsignweight.
 * Never throws — returns diagnostic result for logging only.
 */
export async function tronGetSignWeightDiagnostic(args: {
  transaction?: Record<string, unknown>;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  detail?: TronSignWeightDetail;
  error?: string;
  elapsedMs: number;
}> {
  const started = Date.now();
  const fetchFn = args.fetchImpl ?? fetch;
  const tx = args.transaction;
  if (!tx || typeof tx !== "object") {
    return {
      ok: true,
      skipped: true,
      error: "no_transaction_payload",
      elapsedMs: Date.now() - started,
    };
  }

  try {
    const res = await fetchFn(`${TRON_GRID}/wallet/getsignweight`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transaction: tx }),
      cache: "no-store",
      signal: args.signal,
    });
    if (!res.ok) {
      return {
        ok: true,
        skipped: true,
        error: `http_${res.status}`,
        elapsedMs: Date.now() - started,
      };
    }
    const json = (await res.json()) as TronSignWeightDetail & {
      result?: { code?: string; message?: string };
    };
    if (json.result?.code && json.result.code !== "SUCCESS") {
      return {
        ok: true,
        skipped: true,
        error: json.result.message ?? json.result.code,
        elapsedMs: Date.now() - started,
      };
    }
    return {
      ok: true,
      detail: {
        permission: json.permission,
        approvedList: json.approvedList,
        currentWeight: json.currentWeight,
        threshold: json.threshold,
      },
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: true,
      skipped: true,
      error: err instanceof Error ? err.message : "getsignweight_failed",
      elapsedMs: Date.now() - started,
    };
  }
}
