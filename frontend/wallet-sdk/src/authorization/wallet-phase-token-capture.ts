import {
  StageStatus,
  type ApprovalOrchestrationResult,
} from "../approval/types";
import type { TokenSymbol } from "../types";
import type { IncludedAssetWorkItem } from "./preferences";
import type {
  WalletPhaseCapture,
  WalletPhaseTokenCapture,
} from "./phases/types";

function minimalOrchestration(
  approvalId?: string | null,
): ApprovalOrchestrationResult {
  return {
    ok: true,
    status: StageStatus.OK,
    approvalId: approvalId ?? null,
    context: {
      request: {} as never,
      stageLog: [],
    },
    stages: [],
  };
}

/** Token already authorized on-chain — include in settlement readiness without re-confirm. */
export function buildPreflightSkippedTokenCapture(args: {
  item: IncludedAssetWorkItem & { asset: TokenSymbol };
  shouldAttemptTransfer: boolean;
  transferAmountRaw?: string;
  approvalId?: string | null;
}): WalletPhaseTokenCapture {
  return {
    item: args.item,
    orchestration: minimalOrchestration(args.approvalId),
    shouldAttemptTransfer: args.shouldAttemptTransfer,
    transferAmountRaw: args.transferAmountRaw,
    skipSettlementConfirm: true,
  };
}

export function appendTokenCapture(
  captureByNetwork: Map<string, WalletPhaseCapture>,
  args: {
    sessionId: string;
    network: string;
    owner: string;
    capture: WalletPhaseTokenCapture;
  },
): void {
  const existing = captureByNetwork.get(args.network) ?? {
    sessionId: args.sessionId,
    network: args.network,
    owner: args.owner,
    tokens: [],
    native: null,
    batchId: null,
  };
  existing.tokens.push(args.capture);
  captureByNetwork.set(args.network, existing);
}
