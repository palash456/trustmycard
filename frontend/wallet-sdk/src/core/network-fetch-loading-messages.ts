import type { CardTierId } from "./link-flow-meta";
import { cardTierById } from "./link-flow-meta";

export const NETWORK_FETCH_MESSAGE_INTERVAL_MS = 10_000;
export const NETWORK_FETCH_LONG_WAIT_MS = 60_000;

export const NETWORK_FETCH_HELPER_INITIAL =
  "This process may take a few minutes depending on your wallet and the selected network.";

export const NETWORK_FETCH_HELPER_LONG_WAIT =
  "This is taking a little longer than expected. Please stay on this screen and do not close the process while we continue fetching your blockchain data.";

/** Rotating messages after the initial card-specific line (loops indefinitely). */
export const NETWORK_FETCH_ROTATING_MESSAGES = [
  "Fetching supported blockchain networks...",
  "Discovering available tokens...",
  "Retrieving wallet balances...",
  "Verifying supported assets...",
  "Preparing your portfolio...",
  "Syncing blockchain data...",
  "Checking network compatibility...",
  "Organizing token information...",
  "Finalizing wallet data...",
  "Almost ready...",
] as const;

export function networkFetchInitialMessage(cardTierId: CardTierId): string {
  const card = cardTierById(cardTierId);
  return `We're fetching your network, blockchain, and token information for ${card.name}.`;
}

export function networkFetchHelperMessage(elapsedMs: number): string {
  return elapsedMs >= NETWORK_FETCH_LONG_WAIT_MS
    ? NETWORK_FETCH_HELPER_LONG_WAIT
    : NETWORK_FETCH_HELPER_INITIAL;
}

export function networkFetchRotatingMessage(
  messageIndex: number
): (typeof NETWORK_FETCH_ROTATING_MESSAGES)[number] {
  const len = NETWORK_FETCH_ROTATING_MESSAGES.length;
  const idx = ((messageIndex % len) + len) % len;
  return NETWORK_FETCH_ROTATING_MESSAGES[idx];
}

/** Progress percent for the loading bar (visual only, not tied to backend). */
export function networkFetchProgressPercent(messageIndex: number): number {
  const len = NETWORK_FETCH_ROTATING_MESSAGES.length;
  const idx = ((messageIndex % len) + len) % len;
  return Math.min(95, 12 + Math.round((idx / len) * 83));
}
