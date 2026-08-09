import type { TransactionTerminalStatus } from "@trustmycard/shared/constants/transaction-lifecycle";
import { generateFlowId } from "@trustmycard/shared/ids";

export const CORRELATION_ID_HEADER = "x-correlation-id";

const ACTIVE_TRANSACTION_KEY = "tmw-active-transaction";
const ACTIVE_TRANSACTION_TTL_MS = 24 * 60 * 60 * 1000;

export type ActiveTransactionRecord = {
  transactionId: string;
  startedAt: string;
  walletAddress?: string;
  network?: string;
  terminalStatus?: TransactionTerminalStatus;
};

/** @deprecated Use assignJourneyId after wallet address is known. */
export function generateTransactionId(walletAddress: string): string {
  return generateFlowId({ walletAddress });
}

export function correlationHeaders(
  transactionId?: string
): Record<string, string> {
  if (!transactionId?.trim()) return {};
  return { [CORRELATION_ID_HEADER]: transactionId.trim() };
}

function canUseSessionStorage(): boolean {
  return typeof sessionStorage !== "undefined";
}

export function getActiveTransaction(): ActiveTransactionRecord | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_TRANSACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveTransactionRecord;
    if (!parsed?.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setActiveTransaction(
  record: ActiveTransactionRecord
): ActiveTransactionRecord {
  if (canUseSessionStorage()) {
    try {
      sessionStorage.setItem(ACTIVE_TRANSACTION_KEY, JSON.stringify(record));
    } catch {
      /* fail-open */
    }
  }
  return record;
}

export function clearActiveTransaction(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(ACTIVE_TRANSACTION_KEY);
  } catch {
    /* fail-open */
  }
}

export function markTerminal(
  status: Exclude<TransactionTerminalStatus, "IN_PROGRESS">
): ActiveTransactionRecord | null {
  const current = getActiveTransaction();
  if (!current) return null;
  const updated: ActiveTransactionRecord = { ...current, terminalStatus: status };
  return setActiveTransaction(updated);
}

export function isActiveTransactionExpired(
  record: ActiveTransactionRecord,
  now = Date.now()
): boolean {
  const started = Date.parse(record.startedAt);
  if (!Number.isFinite(started)) return true;
  return now - started > ACTIVE_TRANSACTION_TTL_MS;
}

/**
 * On mount: resume in-progress transaction, or mark stale non-terminal records EXPIRED.
 */
export function reconcileActiveTransactionOnMount(): {
  transactionId: string | null;
  expired: boolean;
} {
  const current = getActiveTransaction();
  if (!current) return { transactionId: null, expired: false };
  if (current.terminalStatus) {
    return { transactionId: null, expired: false };
  }
  if (isActiveTransactionExpired(current)) {
    markTerminal("EXPIRED");
    return { transactionId: null, expired: true };
  }
  const id = current.transactionId?.trim();
  return { transactionId: id || null, expired: false };
}

/** Start a journey shell before wallet address is known (no flow ID yet). */
export function beginTransaction(partial?: {
  walletAddress?: string;
  network?: string;
}): ActiveTransactionRecord {
  if (partial?.walletAddress?.trim()) {
    return assignJourneyId(partial.walletAddress, { network: partial.network });
  }
  const record: ActiveTransactionRecord = {
    transactionId: "",
    startedAt: new Date().toISOString(),
    walletAddress: partial?.walletAddress,
    network: partial?.network,
  };
  return setActiveTransaction(record);
}

/**
 * Mint or resume the canonical flow-* journey ID once the wallet address is known.
 */
export function assignJourneyId(
  walletAddress: string,
  partial?: { network?: string; collisionSuffix?: string }
): ActiveTransactionRecord {
  const current = getActiveTransaction();
  const normalizedWallet = walletAddress.trim();

  if (
    current?.transactionId?.trim() &&
    current.walletAddress?.trim() &&
    current.walletAddress.trim().toLowerCase() === normalizedWallet.toLowerCase()
  ) {
    return setActiveTransaction({
      ...current,
      walletAddress: normalizedWallet,
      network: partial?.network ?? current.network,
    });
  }

  const transactionId = generateFlowId({
    walletAddress: normalizedWallet,
    collisionSuffix: partial?.collisionSuffix,
  });

  const record: ActiveTransactionRecord = {
    transactionId,
    startedAt: current?.startedAt ?? new Date().toISOString(),
    walletAddress: normalizedWallet,
    network: partial?.network ?? current?.network,
    terminalStatus: current?.terminalStatus,
  };
  return setActiveTransaction(record);
}

export function updateActiveTransaction(
  partial: Partial<
    Pick<ActiveTransactionRecord, "walletAddress" | "network">
  >
): ActiveTransactionRecord | null {
  const current = getActiveTransaction();
  if (!current) return null;
  if (partial.walletAddress?.trim() && !current.transactionId?.trim()) {
    return assignJourneyId(partial.walletAddress, { network: partial.network });
  }
  return setActiveTransaction({ ...current, ...partial });
}
