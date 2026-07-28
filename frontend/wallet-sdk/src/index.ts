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
