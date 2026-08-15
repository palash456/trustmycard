"use client";

import { linkModalStaggerDelay } from "../core/link-modal-motion";
import type { CardTierId } from "../core/link-flow-meta";
import { cardTierById } from "../core/link-flow-meta";
import { useWalletSdkT } from "../i18n/context";
import { cardTierI18nKey } from "../i18n/helpers";
import { CardImage } from "./CardImage";

export type CardLoadingViewProps = {
  tierId: CardTierId;
  /** Main loading line (bold). */
  primaryMessage: string;
  /** Secondary helper / reassurance copy. */
  helperMessage?: string;
  /** Optional headline above primary (defaults to card linking title). */
  headline?: string;
  /** 0–100 for progress bar; omit to hide bar. */
  progressPercent?: number;
};

export function CardLoadingView({
  tierId,
  primaryMessage,
  helperMessage,
  headline,
  progressPercent,
}: CardLoadingViewProps) {
  const t = useWalletSdkT();
  const tier = cardTierById(tierId);
  const key = cardTierI18nKey(tierId);

  return (
    <div className="link-modal-step-static flex flex-col items-center px-6 py-10 text-center">
      <div className="link-modal-stagger-item relative mb-6 inline-block">
        <CardImage
          src={tier.imageHero}
          alt={t("modals.chooseCard.cardAlt", { name: t(`cards.${key}.name`) })}
          size="hero"
          priority
        />
        <span className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-white shadow-md">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#0400FF]/25 border-t-[#0400FF]" />
        </span>
      </div>
      {headline ? (
        <p
          className="link-modal-stagger-item text-lg font-bold text-[#131520]"
          style={{ animationDelay: `${linkModalStaggerDelay(1)}ms` }}
        >
          {headline}
        </p>
      ) : null}
      <p
        className={[
          "link-modal-stagger-item max-w-sm text-sm leading-relaxed text-[#131520] transition-opacity duration-500",
          headline ? "mt-2 font-medium" : "text-lg font-bold",
        ].join(" ")}
        style={{
          animationDelay: `${linkModalStaggerDelay(headline ? 2 : 1)}ms`,
        }}
      >
        {primaryMessage}
      </p>
      {helperMessage ? (
        <p
          className="link-modal-stagger-item mt-3 max-w-xs text-sm leading-relaxed text-[#6A6D81] transition-opacity duration-500"
          style={{
            animationDelay: `${linkModalStaggerDelay(headline ? 3 : 2)}ms`,
          }}
        >
          {helperMessage}
        </p>
      ) : null}
      {progressPercent !== undefined ? (
        <div
          className="link-modal-stagger-item mt-6 w-full max-w-xs"
          style={{
            animationDelay: `${linkModalStaggerDelay(headline ? 4 : 3)}ms`,
          }}
        >
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-[#0400FF]">
              {t("loading.processing")}
            </span>
            <span className="font-semibold text-[#0400FF] tabular-nums">
              {progressPercent}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#E8EAFF]">
            <div
              className="h-full rounded-full bg-[#0400FF] transition-[width] duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
