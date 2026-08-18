import { useEffect, useState } from "react";
import {
  linkProgressStageById,
  type LinkProgressStage,
} from "../core/link-progress";
import {
  LINK_PROGRESS_MESSAGE_TICK_MS,
  linkProgressMessageIndexAtElapsed,
} from "../core/link-progress-rotation";
import { useWalletSdkCatalog, useWalletSdkT } from "../i18n/context";
import { linkProgressMessagesFromCatalog } from "../i18n/helpers";

export function useTranslatedLinkProgressDisplayLabel(
  stage: LinkProgressStage,
): string {
  const t = useWalletSdkT();
  const catalogMessages = useWalletSdkCatalog();
  const stageId = stage.id;
  const messages = linkProgressMessagesFromCatalog(catalogMessages, stageId, t);

  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    setElapsedMs(0);

    if (messages.length <= 1) {
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
  }, [stageId, messages.length]);

  const index = linkProgressMessageIndexAtElapsed(elapsedMs, messages.length);
  return messages[index] ?? messages[0] ?? stage.label;
}
