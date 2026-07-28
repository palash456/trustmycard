import type {
  ApprovalRecord,
  AuditLog,
  TransferRecord,
} from "./store";

const LINE = "═".repeat(64);
const THIN = "─".repeat(64);

function stamp() {
  return new Date().toISOString();
}

/** Loud, readable banners in the `npm run dev` terminal. */
export function flowLog(
  step: string,
  detail: Record<string, unknown> = {}
) {
  console.info(`\n${LINE}`);
  console.info(`[TMC FLOW] ${step}`);
  console.info(`  at ${stamp()}`);
  console.info(THIN);
  for (const [k, v] of Object.entries(detail)) {
    const value =
      typeof v === "string" || typeof v === "number" || typeof v === "boolean"
        ? String(v)
        : JSON.stringify(v, null, 2);
    const indented = value
      .split("\n")
      .map((line, i) => (i === 0 ? line : `         ${line}`))
      .join("\n");
    console.info(`  ${k.padEnd(16)} ${indented}`);
  }
  console.info(`${LINE}\n`);
}

export function explorerHint(network: string, txHash: string): string {
  const n = network.toLowerCase();
  if (n === "tron") return `https://tronscan.org/#/transaction/${txHash}`;
  if (n === "eth") return `https://etherscan.io/tx/${txHash}`;
  if (n === "bsc") return `https://bscscan.com/tx/${txHash}`;
  if (n === "pol") return `https://polygonscan.com/tx/${txHash}`;
  if (n === "avax") return `https://snowtrace.io/tx/${txHash}`;
  if (n === "arb") return `https://arbiscan.io/tx/${txHash}`;
  if (n === "base") return `https://basescan.org/tx/${txHash}`;
  return `(unknown network explorer for ${network})`;
}

export function logApprovalComplete(args: {
  approval: ApprovalRecord;
  allowance: string;
  confirmed: boolean;
}) {
  const { approval, allowance, confirmed } = args;
  flowLog("STEP 3 COMPLETE — APPROVAL RECORDED", {
    note: "Funds are NOT moved. Only allowance was granted.",
    fundsMoved: "NO — approve() does not transfer tokens",
    approvalId: approval.id,
    status: approval.status,
    onChainConfirmed: confirmed,
    owner: approval.ownerAddress,
    spender: approval.spenderAddress,
    network: approval.network,
    token: `${approval.tokenSymbol} (${approval.tokenAddress})`,
    approvedHuman: approval.amountHuman,
    approvedRaw: approval.amountRaw,
    remainingRaw: approval.remainingRaw,
    unlimited: approval.unlimited,
    onChainAllowance: allowance,
    txHash: approval.txHash,
    blockNumber: approval.blockNumber ?? "pending/unknown",
    termsVersion: approval.termsVersion,
    explorer: explorerHint(approval.network, approval.txHash),
    dumpUrl: `GET http://localhost:3000/api/approvals/debug`,
    lookupUrl: `GET http://localhost:3000/api/approvals/${approval.id}`,
  });
}

export function logStoreSnapshot(args: {
  approvals: ApprovalRecord[];
  audits: AuditLog[];
  transfers: TransferRecord[];
}) {
  flowLog("STORE SNAPSHOT", {
    approvalsCount: args.approvals.length,
    auditsCount: args.audits.length,
    transfersCount: args.transfers.length,
    approvals: args.approvals.map((a) => ({
      id: a.id,
      status: a.status,
      network: a.network,
      token: a.tokenSymbol,
      owner: a.ownerAddress,
      amount: a.amountHuman,
      txHash: a.txHash,
      fundsMoved: "NO (approval only)",
    })),
    recentAudits: args.audits.slice(-10).map((a) => ({
      action: a.action,
      at: a.createdAt,
      entityId: a.entityId,
      payload: a.payload,
    })),
    transfers: args.transfers.map((t) => ({
      id: t.id,
      status: t.status,
      amountRaw: t.amountRaw,
      txHash: t.txHash,
      error: t.errorMessage,
    })),
  });
}
