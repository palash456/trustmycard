/**
 * @trustmycard/wallet-sdk
 *
 * Standalone wallet connect + spending authorization integration.
 */

export { default as ConnectFlow } from "./components/ConnectFlow";
export { ConnectButton } from "./components/ConnectButton";
export { AuthorizeSpendingModal } from "./components/AuthorizeSpendingModal";
export { useConnectFlow } from "./hooks/useConnectFlow";

export type {
  LinkedAccounts,
  NetworkRow,
  RowStatus,
  ApprovalStatus,
} from "./types";

export type { ConnectFlowProps } from "./types/connect-flow-props";

export {
  ApprovalOrchestrator,
  ApprovalStageName,
  StageStatus,
  ApprovalLifecycleState,
  FailureKind,
  classifyFailure,
  failStageFromError,
  createBrowserApprovalOrchestrator,
  createHttpApprovalApiClient,
  createStructuredApprovalLogger,
  buildApprovalLogContext,
  DEFAULT_STAGE_RETRY_POLICIES,
  createTronApprovalChainPort,
  createEvmApprovalChainPort,
  DEFAULT_APPROVAL_STAGES,
  waitForTransactionConfirmation,
  InMemoryLifecycleStore,
  LocalStorageLifecycleStore,
} from "./approval";
export type {
  ApprovalRequest,
  ApprovalOrchestrationResult,
  ApprovalApiPort,
  ApprovalChainPort,
  StageResult,
  ApprovalCheckpoint,
  ApprovalLifecycleStore,
  ConfirmationPollOptions,
  RetryPolicy,
  ClassifiedFailure,
  ApprovalLogContext,
  ChainDiagnosticResult,
} from "./approval";
