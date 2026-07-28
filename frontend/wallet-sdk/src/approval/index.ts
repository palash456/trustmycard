export {
  ApprovalStageName,
  StageStatus,
  okStage,
  failStage,
  skippedStage,
  cancelledStage,
  timeoutStage,
  isStageSuccess,
} from "./types";
export type {
  ApprovalRequest,
  ApprovalContext,
  ApprovalOrchestrationResult,
  OrchestratorOptions,
  StageResult,
  PreparedApproval,
  ApprovalLogger,
  ConfirmationResult,
} from "./types";

export type { ApprovalApiPort, ApprovalChainPort } from "./ports";
export { ApprovalOrchestrator } from "./orchestrator";
export { createHttpApprovalApiClient } from "./http-api-client";
export { createBrowserApprovalOrchestrator } from "./create-browser-orchestrator";
export { createTronApprovalChainPort } from "./chains/tron-chain-port";
export { createEvmApprovalChainPort } from "./chains/evm-chain-port";
export {
  DEFAULT_APPROVAL_STAGES,
  prepareStage,
  acquireResourcesStage,
  waitResourcesReadyStage,
  signStage,
  broadcastStage,
  waitConfirmationStage,
  verifyApprovalStage,
  persistApprovalStage,
  postApprovalStage,
} from "./stages";

export {
  ApprovalLifecycleState,
  buildCheckpointId,
  isResumableLifecycle,
  InMemoryLifecycleStore,
  LocalStorageLifecycleStore,
  buildCheckpoint,
  restoreContextFromCheckpoint,
} from "./lifecycle";
export type { ApprovalCheckpoint, ApprovalLifecycleStore } from "./lifecycle";

export {
  waitForTransactionConfirmation,
  TransactionConfirmationStatus,
  DEFAULT_CONFIRMATION_OPTIONS,
} from "./confirmation/poller";
export type {
  TransactionStatusSnapshot,
  ConfirmationPollOptions,
} from "./confirmation/poller";

export {
  FailureKind,
  classifyFailure,
  isStageRetryAllowed,
  failStageFromError,
  DEFAULT_RETRY_POLICY,
  DEFAULT_STAGE_RETRY_POLICIES,
  resolveRetryPolicy,
  computeBackoffDelay,
  withRetry,
} from "./resilience";
export type { RetryPolicy, ClassifiedFailure } from "./resilience";

export {
  buildApprovalLogContext,
  createStructuredApprovalLogger,
} from "./observability/structured-logger";
export type { ApprovalLogContext } from "./observability/structured-logger";

export {
  runChainDiagnosticsSafe,
  tronGetSignWeightDiagnostic,
} from "./diagnostics/runner";
export type { ChainDiagnosticResult } from "./diagnostics/types";
