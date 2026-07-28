import type {
  ApprovalRequest,
  BroadcastResult,
  PreparedApproval,
  PersistApprovalResult,
  PostApprovalResult,
  SignedApproval,
  VerifyApprovalResult,
} from "./types";
import type { ResourceResult } from "../core/resource-sponsor-client";
import type { TransactionStatusSnapshot } from "./confirmation/types";
import type { ChainDiagnosticResult, ChainDiagnosticsArgs } from "./diagnostics/types";

/**
 * Chain-specific signing, broadcast, transaction status, and optional diagnostics.
 * New chains implement this port only.
 */
export type ApprovalChainPort = {
  readonly networks: readonly string[];
  supports(network: string): boolean;
  sign(args: {
    prepared: PreparedApproval;
    owner: string;
    signal?: AbortSignal;
  }): Promise<SignedApproval>;
  broadcast(args: {
    signed: SignedApproval;
    prepared: PreparedApproval;
    signal?: AbortSignal;
  }): Promise<BroadcastResult>;
  /** Pollable on-chain transaction status for confirmation stage. */
  getTransactionStatus(args: {
    txHash: string;
    network: string;
    signal?: AbortSignal;
  }): Promise<TransactionStatusSnapshot>;
  /**
   * Optional non-blocking diagnostics (e.g. TRON getSignWeight).
   * Must never throw — failures are logged and ignored.
   */
  runDiagnostics?(args: ChainDiagnosticsArgs): Promise<ChainDiagnosticResult[]>;
};

/**
 * HTTP / backend operations used by stages (prepare, resources, confirm, logging).
 */
export type ApprovalApiPort = {
  prepare(args: {
    request: ApprovalRequest;
    signal?: AbortSignal;
  }): Promise<PreparedApproval>;
  acquireResources(args: {
    request: ApprovalRequest;
    prepared: PreparedApproval;
    signal?: AbortSignal;
  }): Promise<ResourceResult>;
  verifyResources(args: {
    request: ApprovalRequest;
    prepared: PreparedApproval;
    signal?: AbortSignal;
  }): Promise<ResourceResult>;
  /** Read-only allowance check — must run only after tx confirmation. */
  verifyAllowance(args: {
    request: ApprovalRequest;
    prepared: PreparedApproval;
    signal?: AbortSignal;
  }): Promise<VerifyApprovalResult>;
  /** Persist approval metadata + optional transfer queue (idempotent by txHash). */
  persistApproval(args: {
    request: ApprovalRequest;
    prepared: PreparedApproval;
    txHash: string;
    verified: VerifyApprovalResult;
    signal?: AbortSignal;
  }): Promise<PersistApprovalResult>;
  /**
   * @deprecated Use verifyAllowance + persistApproval. Kept for backward compatibility.
   */
  confirmApproval?(args: {
    request: ApprovalRequest;
    prepared: PreparedApproval;
    txHash: string;
    signal?: AbortSignal;
  }): Promise<PersistApprovalResult & VerifyApprovalResult>;
  postApprovalLog(args: {
    request: ApprovalRequest;
    ok: boolean;
    error?: string | null;
    signal?: AbortSignal;
  }): Promise<PostApprovalResult>;
};