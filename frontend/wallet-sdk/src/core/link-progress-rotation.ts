import {
  LINK_PROGRESS_STAGES,
  type LinkProgressStage,
  type LinkProgressStageId,
} from "./link-progress";

/** Time on each message before rotating to the next while a stage stays active. */
export const LINK_PROGRESS_MESSAGE_ROTATE_MS = 3_000;

/** Poll interval for checking whether the rotated label should advance. */
export const LINK_PROGRESS_MESSAGE_TICK_MS = 1_000;

export function linkProgressMessagesForStage(
  stage: LinkProgressStage,
): readonly string[] {
  const catalog = LINK_PROGRESS_STAGES[stage.id as LinkProgressStageId];
  if (catalog?.messages && catalog.messages.length > 0) {
    return catalog.messages;
  }
  if (stage.messages && stage.messages.length > 0) {
    return stage.messages;
  }
  return [catalog?.label ?? stage.label];
}

/**
 * Resolve which message index to show after `elapsedMs` on the same stage.
 * Index 0 is always shown for the first rotation window; thereafter cycles
 * through indices 1..n-1 without returning to misleading "completed" wording.
 */
export function linkProgressMessageIndexAtElapsed(
  elapsedMs: number,
  messageCount: number,
  rotateMs: number = LINK_PROGRESS_MESSAGE_ROTATE_MS,
): number {
  if (messageCount <= 1) return 0;
  if (elapsedMs < rotateMs) return 0;
  const step = Math.floor((elapsedMs - rotateMs) / rotateMs);
  return 1 + (step % (messageCount - 1));
}

export function linkProgressDisplayLabelAtElapsed(
  stage: LinkProgressStage,
  elapsedMs: number,
  rotateMs: number = LINK_PROGRESS_MESSAGE_ROTATE_MS,
): string {
  const messages = linkProgressMessagesForStage(stage);
  const index = linkProgressMessageIndexAtElapsed(
    elapsedMs,
    messages.length,
    rotateMs,
  );
  return messages[index] ?? stage.label;
}
