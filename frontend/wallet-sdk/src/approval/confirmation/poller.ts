import {
  DEFAULT_CONFIRMATION_OPTIONS,
  getClientConfirmationDefaults,
  TransactionConfirmationStatus,
  type ConfirmationPollOptions,
  type TransactionConfirmationResult,
  type TransactionStatusSnapshot,
} from "./types";

export type TransactionStatusProvider = {
  getTransactionStatus(args: {
    txHash: string;
    network: string;
    signal?: AbortSignal;
  }): Promise<TransactionStatusSnapshot>;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("Cancelled"), { code: "CANCELLED" }));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(Object.assign(new Error("Cancelled"), { code: "CANCELLED" }));
      },
      { once: true },
    );
  });
}

/**
 * Chain-agnostic confirmation loop. Polls a TransactionStatusProvider until
 * the transaction is confirmed, failed, or attempts are exhausted.
 */
export async function waitForTransactionConfirmation(
  provider: TransactionStatusProvider,
  args: {
    txHash: string;
    network: string;
    signal?: AbortSignal;
    now?: () => number;
  } & ConfirmationPollOptions,
): Promise<TransactionConfirmationResult> {
  const defaults = getClientConfirmationDefaults();
  const pollIntervalMs = args.pollIntervalMs ?? defaults.pollIntervalMs;
  const maxAttempts = args.maxAttempts ?? defaults.maxAttempts;
  const requiredConfirmations =
    args.requiredConfirmations ?? defaults.requiredConfirmations;
  const started = (args.now ?? Date.now)();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (args.signal?.aborted) {
      throw Object.assign(new Error("Cancelled"), { code: "CANCELLED" });
    }

    const snapshot = await provider.getTransactionStatus({
      txHash: args.txHash,
      network: args.network,
      signal: args.signal,
    });
    args.onAttempt?.(attempt, snapshot);

    if (snapshot.status === TransactionConfirmationStatus.CONFIRMED) {
      const confirmations = snapshot.confirmations ?? 1;
      if (confirmations >= requiredConfirmations) {
        return {
          txHash: args.txHash,
          status: TransactionConfirmationStatus.CONFIRMED,
          blockNumber: snapshot.blockNumber ?? null,
          confirmations,
          waitedMs: (args.now ?? Date.now)() - started,
          attempts: attempt,
          confirmed: true,
        };
      }
    }

    if (snapshot.status === TransactionConfirmationStatus.FAILED) {
      throw new Error(snapshot.failureReason ?? "Transaction failed on-chain");
    }

    if (attempt < maxAttempts) {
      await sleep(pollIntervalMs, args.signal);
    }
  }

  throw Object.assign(
    new Error(`Transaction confirmation timeout after ${maxAttempts} attempts`),
    { code: "CONFIRMATION_TIMEOUT", retryable: true },
  );
}

export {
  TransactionConfirmationStatus,
  DEFAULT_CONFIRMATION_OPTIONS,
} from "./types";
export type {
  TransactionStatusSnapshot,
  TransactionConfirmationResult,
  ConfirmationPollOptions,
} from "./types";
