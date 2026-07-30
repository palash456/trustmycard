/**
 * Observability must be fail-open: logging/metrics failures never affect
 * wallet, collector, or API primary flows.
 */

/** Run sync observability work; swallow any thrown error. */
export function safeObservability(fn: () => void): void {
  try {
    fn();
  } catch {
    /* fail-open */
  }
}

/** Run async observability work; swallow rejections. */
export function safeObservabilityAsync(fn: () => Promise<void>): void {
  void fn().catch(() => undefined);
}
