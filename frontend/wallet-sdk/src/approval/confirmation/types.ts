import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";

export const TransactionConfirmationStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
  NOT_FOUND: "NOT_FOUND",
} as const;

export type TransactionConfirmationStatus =
  (typeof TransactionConfirmationStatus)[keyof typeof TransactionConfirmationStatus];

export type TransactionStatusSnapshot = {
  status: TransactionConfirmationStatus;
  txHash: string;
  blockNumber?: number | null;
  confirmations?: number;
  failureReason?: string;
};

export type TransactionConfirmationResult = {
  txHash: string;
  status: typeof TransactionConfirmationStatus.CONFIRMED;
  blockNumber?: number | null;
  confirmations: number;
  waitedMs: number;
  attempts: number;
  confirmed: true;
};

export type ConfirmationPollOptions = {
  pollIntervalMs?: number;
  maxAttempts?: number;
  requiredConfirmations?: number;
  /** Per-poll timeout — not overall (use AbortSignal for overall). */
  onAttempt?: (attempt: number, snapshot: TransactionStatusSnapshot) => void;
};

export const DEFAULT_CONFIRMATION_OPTIONS: Required<
  Pick<
    ConfirmationPollOptions,
    "pollIntervalMs" | "maxAttempts" | "requiredConfirmations"
  >
> = {
  pollIntervalMs: 2_000,
  maxAttempts: 30,
  requiredConfirmations: 1,
};

let activeConfirmationDefaults = { ...DEFAULT_CONFIRMATION_OPTIONS };

export function setClientConfirmationDefaults(
  platform?: PublicPlatformConfig
): void {
  if (!platform?.client) {
    activeConfirmationDefaults = { ...DEFAULT_CONFIRMATION_OPTIONS };
    return;
  }
  activeConfirmationDefaults = {
    pollIntervalMs: platform.client.confirmationPollMs,
    maxAttempts: platform.client.confirmationMaxAttempts,
    requiredConfirmations: platform.client.confirmationConfirmations,
  };
}

export function getClientConfirmationDefaults(): typeof activeConfirmationDefaults {
  return activeConfirmationDefaults;
}
