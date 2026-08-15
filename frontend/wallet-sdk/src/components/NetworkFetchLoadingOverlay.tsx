import type { CardTierId } from "../core/link-flow-meta";
import { useTranslatedNetworkFetchLoadingMessages } from "../hooks/useTranslatedNetworkFetchLoadingMessages";
import { useWalletSdkT } from "../i18n/context";
import { CardLoadingView } from "./CardLoadingView";

type NetworkFetchLoadingOverlayProps = {
  open: boolean;
  cardTierId: CardTierId;
};

/** Stacked above LinkNetworkModal while post-approval backend work runs. */
export function NetworkFetchLoadingOverlay({
  open,
  cardTierId,
}: NetworkFetchLoadingOverlayProps) {
  const t = useWalletSdkT();
  const { primaryMessage, helperMessage, progressPercent } =
    useTranslatedNetworkFetchLoadingMessages({
      active: open,
      cardTierId,
    });

  if (!open) return null;

  return (
    <div
      className="link-modal-overlay fixed inset-0 z-[110] flex items-center justify-center bg-[#131520]/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={t("overlay.fetch.ariaLabel")}
    >
      <div className="link-modal-panel card-surface flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl shadow-xl">
        <div className="link-modal-stagger-item shrink-0 px-6 pb-2 pt-6">
          <h2 className="text-xl font-bold text-[#131520]">
            {t("overlay.fetch.title")}
          </h2>
          <p className="mt-1 text-sm text-[#6A6D81]">
            {t("overlay.fetch.subtitle")}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CardLoadingView
            tierId={cardTierId}
            primaryMessage={primaryMessage}
            helperMessage={helperMessage}
            progressPercent={progressPercent}
          />
        </div>
      </div>
    </div>
  );
}
