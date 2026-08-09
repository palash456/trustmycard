export type ChainDiagnosticPhase = "pre-sign" | "post-sign" | "post-broadcast";

export type ChainDiagnosticResult = {
  name: string;
  ok: boolean;
  skipped?: boolean;
  detail?: Record<string, unknown>;
  error?: string;
  elapsedMs?: number;
};

export type ChainDiagnosticsArgs = {
  phase: ChainDiagnosticPhase;
  network: string;
  owner: string;
  prepared?: import("../types").PreparedApproval;
  signed?: import("../types").SignedApproval;
  txHash?: string;
  signal?: AbortSignal;
};
