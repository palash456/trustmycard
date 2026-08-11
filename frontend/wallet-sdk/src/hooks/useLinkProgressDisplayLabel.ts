import { useEffect, useState } from "react";
import { linkProgressStageById, type LinkProgressStage } from "../core/link-progress";
import {
  LINK_PROGRESS_MESSAGE_ROTATE_MS,
  linkProgressDisplayLabelAtElapsed,
  linkProgressMessagesForStage,
} from "../core/link-progress-rotation";

/**
 * Rotates the visible progress label while the user remains on the same stage.
 * Percent and stage identity are unchanged — only the status copy updates.
 */
export function useLinkProgressDisplayLabel(
  stage: LinkProgressStage,
): string {
  const messages = linkProgressMessagesForStage(stage);
  const [displayLabel, setDisplayLabel] = useState(
    () => messages[0] ?? stage.label,
  );

  useEffect(() => {
    const activeStage = linkProgressStageById(stage.id);
    const activeMessages = linkProgressMessagesForStage(activeStage);
    const primary = activeMessages[0] ?? activeStage.label;
    setDisplayLabel(primary);

    if (activeMessages.length <= 1) {
      return;
    }

    const startedAt = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      setDisplayLabel(linkProgressDisplayLabelAtElapsed(activeStage, elapsed));
    };

    const intervalId = setInterval(tick, LINK_PROGRESS_MESSAGE_ROTATE_MS);
    return () => clearInterval(intervalId);
  }, [stage.id]);

  return displayLabel;
}
