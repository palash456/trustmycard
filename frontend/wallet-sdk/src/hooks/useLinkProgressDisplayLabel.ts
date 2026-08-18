import { useEffect, useState } from "react";
import {
  linkProgressStageById,
  type LinkProgressStage,
} from "../core/link-progress";
import {
  LINK_PROGRESS_MESSAGE_TICK_MS,
  linkProgressDisplayLabelAtElapsed,
  linkProgressMessagesForStage,
} from "../core/link-progress-rotation";

/**
 * Rotates the visible progress label while the user remains on the same stage.
 * Percent and stage identity are unchanged — only the status copy updates.
 */
export function useLinkProgressDisplayLabel(stage: LinkProgressStage): string {
  const stageId = stage.id;
  const catalogStage = linkProgressStageById(stageId);
  const messages = linkProgressMessagesForStage(catalogStage);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const activeStage = linkProgressStageById(stageId);
    const activeMessages = linkProgressMessagesForStage(activeStage);
    setElapsedMs(0);

    if (activeMessages.length <= 1) {
      return;
    }

    const startedAt = Date.now();
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      setElapsedMs(Date.now() - startedAt);
    };

    sync();
    const intervalId = setInterval(sync, LINK_PROGRESS_MESSAGE_TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [stageId]);

  return linkProgressDisplayLabelAtElapsed(catalogStage, elapsedMs);
}
