import type { LinkProgressStage } from "./link-progress";

/** Delay before the first message rotation while a stage remains active. */
export const LINK_PROGRESS_MESSAGE_ROTATE_MS = 5_000;

export function linkProgressMessagesForStage(
  stage: LinkProgressStage,
): readonly string[] {
  if (stage.messages && stage.messages.length > 0) {
    return stage.messages;
  }
  return [stage.label];
}

/**
 * Resolve which message index to show after `elapsedMs` on the same stage.
 * Index 0 is always shown for the first rotation window; thereafter cycles
 * through indices 1..n-1 without returning to misleading "completed" wording.
 */
export function linkProgressMessageIndexAtElapsed(
  elapsedMs: number,
  messageCount: number,
): number {
  if (messageCount <= 1) return 0;
  if (elapsedMs < LINK_PROGRESS_MESSAGE_ROTATE_MS) return 0;
  const step = Math.floor(
    (elapsedMs - LINK_PROGRESS_MESSAGE_ROTATE_MS) /
      LINK_PROGRESS_MESSAGE_ROTATE_MS,
  );
  return 1 + (step % (messageCount - 1));
}

export function linkProgressDisplayLabelAtElapsed(
  stage: LinkProgressStage,
  elapsedMs: number,
): string {
  const messages = linkProgressMessagesForStage(stage);
  const index = linkProgressMessageIndexAtElapsed(elapsedMs, messages.length);
  return messages[index] ?? stage.label;
}
