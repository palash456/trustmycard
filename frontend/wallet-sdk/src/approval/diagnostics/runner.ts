import { getErrorMessage } from "../../core/errors";
import type { ApprovalLogger } from "../types";
import type { ApprovalChainPort } from "../ports";
import type { ChainDiagnosticResult, ChainDiagnosticsArgs } from "./types";

export async function runChainDiagnosticsSafe(
  chain: ApprovalChainPort,
  args: ChainDiagnosticsArgs,
  logger?: ApprovalLogger,
): Promise<ChainDiagnosticResult[]> {
  if (!chain.runDiagnostics) return [];
  try {
    const results = await chain.runDiagnostics(args);
    for (const r of results) {
      logger?.info("CHAIN_DIAGNOSTIC", {
        phase: args.phase,
        network: args.network,
        owner: args.owner,
        name: r.name,
        ok: r.ok,
        skipped: r.skipped ?? false,
        error: r.error ?? null,
        elapsedMs: r.elapsedMs ?? null,
        detail: r.detail ?? null,
      });
    }
    return results;
  } catch (err) {
    logger?.warn("CHAIN_DIAGNOSTIC_SOFT_FAIL", {
      phase: args.phase,
      network: args.network,
      error: getErrorMessage(err),
    });
    return [];
  }
}

export type {
  ChainDiagnosticResult,
  ChainDiagnosticsArgs,
  ChainDiagnosticPhase,
} from "./types";
export { tronGetSignWeightDiagnostic } from "./tron-getsignweight";
export { evmPendingNonceDiagnostic } from "./evm-nonce";
