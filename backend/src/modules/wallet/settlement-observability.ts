import {
  NETWORK_SETTLEMENT_STATUS_LABELS,
  type NetworkSettlementStatus,
} from "@trustmycard/shared/constants/settlement";
import type { LogStatus } from "@trustmycard/shared/observability";
import { ObservabilityService } from "../observability/observability.service";

type EmitArgs = {
  settlementSessionId: string;
  clientSessionId?: string | null;
  ownerAddress: string;
  network: string;
  status: NetworkSettlementStatus;
  message?: string;
  token?: string;
  errorMessage?: string;
  txHash?: string;
  context?: Record<string, unknown>;
};

export class SettlementObservability {
  constructor(private readonly observability: ObservabilityService) {}

  emitTransition(args: EmitArgs): void {
    const message =
      args.message?.trim() ||
      (args.token
        ? `${NETWORK_SETTLEMENT_STATUS_LABELS[args.status]} (${args.token})`
        : NETWORK_SETTLEMENT_STATUS_LABELS[args.status]);

    const isFailed = args.status === "FAILED";
    const isComplete = args.status === "COMPLETED";
    const logStatus: LogStatus = isFailed
      ? "failure"
      : isComplete
        ? "success"
        : "in_progress";

    this.observability.schedulePersistLog({
      module: "settlement",
      operation: "state_transition",
      stage: args.status,
      status: logStatus,
      level: isFailed ? "error" : "info",
      message,
      walletAddress: args.ownerAddress,
      network: args.network,
      sessionId: args.clientSessionId ?? undefined,
      correlationId: args.settlementSessionId,
      txHash: args.txHash,
      ...(args.errorMessage ? { error: { message: args.errorMessage } } : {}),
      context: {
        settlementSessionId: args.settlementSessionId,
        token: args.token,
        ...args.context,
      },
    });
  }

  emitTokenCollected(args: {
    settlementSessionId: string;
    clientSessionId?: string | null;
    ownerAddress: string;
    network: string;
    token: string;
    settled: boolean;
    state?: string;
    stateLabel?: string;
    txHash?: string;
    errorMessage?: string;
  }): void {
    const stateSuffix = args.stateLabel ? ` (${args.stateLabel})` : "";
    this.observability.schedulePersistLog({
      module: "settlement",
      operation: "token_settled",
      stage: "TOKEN_SETTLED",
      status: (args.settled ? "success" : "partial_success") as LogStatus,
      level: args.settled ? "info" : "warn",
      message: args.settled
        ? `${args.token} collection ${args.txHash ? "confirmed" : "marked complete"}${stateSuffix}`
        : `${args.token} collection skipped or pending${stateSuffix}`,
      walletAddress: args.ownerAddress,
      network: args.network,
      sessionId: args.clientSessionId ?? undefined,
      correlationId: args.settlementSessionId,
      txHash: args.txHash,
      ...(args.errorMessage ? { error: { message: args.errorMessage } } : {}),
      context: {
        settlementSessionId: args.settlementSessionId,
        token: args.token,
        settled: args.settled,
      },
    });
  }
}
