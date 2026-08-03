"use client";

import { useEffect, useState } from "react";
import {
  CARD_TIERS,
  cardTierById,
  type CardTierId,
} from "../core/link-flow-meta";
import { linkModalStaggerDelay } from "../core/link-modal-motion";
import { CardImage } from "./CardImage";

type ChooseCardModalProps = {
  onClose: () => void;
  onContinue: (tierId: CardTierId) => void;
  selectedTierId: CardTierId;
  connecting?: boolean;
  connectingTierId?: CardTierId;
  error?: string | null;
};

function RadioIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      className={[
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
        selected ? "border-[#0400FF]" : "border-[#D1D5DB]",
      ].join(" ")}
    >
      {selected ? (
        <span className="h-2.5 w-2.5 rounded-full bg-[#0400FF]" />
      ) : null}
    </span>
  );
}

function ConnectingView({ tierId }: { tierId: CardTierId }) {
  const tier = cardTierById(tierId);

  return (
    <div className="link-modal-step flex flex-col items-center px-6 py-10 text-center">
      <div className="link-modal-stagger-item relative mb-6 inline-block">
        <CardImage
          src={tier.image}
          alt={`${tier.name} card`}
          size="hero"
          priority
        />
        <span className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-white shadow-md">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#0400FF]/25 border-t-[#0400FF]" />
        </span>
      </div>
      <p
        className="link-modal-stagger-item text-lg font-bold text-[#131520]"
        style={{ animationDelay: `${linkModalStaggerDelay(1)}ms` }}
      >
        Connecting to your {tier.name} card
      </p>
      <p
        className="link-modal-stagger-item mt-2 max-w-xs text-sm leading-relaxed text-[#6A6D81]"
        style={{ animationDelay: `${linkModalStaggerDelay(2)}ms` }}
      >
        Preparing WalletConnect. Your QR code will appear in a moment…
      </p>
    </div>
  );
}

export function ChooseCardModal({
  onClose,
  onContinue,
  selectedTierId,
  connecting = false,
  connectingTierId = "silver",
  error = null,
}: ChooseCardModalProps) {
  const [selectedTier, setSelectedTier] = useState<CardTierId>(selectedTierId);

  useEffect(() => {
    if (!connecting) {
      setSelectedTier(selectedTierId);
    }
  }, [selectedTierId, connecting]);

  return (
    <div className="link-modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-[#131520]/40 px-4 backdrop-blur-[2px]">
      <div className="link-modal-panel card-surface flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl">
        <div className="link-modal-stagger-item shrink-0 px-6 pb-2 pt-6">
          <div className="flex items-start justify-between">
            <div className="link-modal-step min-w-0 flex-1">
              <h2 className="text-xl font-bold text-[#131520] transition-opacity duration-200">
                {connecting ? "Link Your Card" : "Choose Your Card"}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[#6A6D81] transition-opacity duration-200">
                {connecting
                  ? "Hang tight while we connect your wallet."
                  : "Select a card tier to link with your non-custodial wallet. Zero annual fee. Zero hidden fees."}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              disabled={connecting}
              className="link-modal-interactive ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ECECEF] text-[#6A6D81] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {connecting ? (
            <ConnectingView tierId={connectingTierId} />
          ) : (
            <div key="select" className="link-modal-step">
              {error ? (
                <p className="link-modal-stagger-item mx-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </p>
              ) : null}

              <div className="space-y-3 px-6 py-4">
                {CARD_TIERS.map((tier, index) => {
                  const selected = selectedTier === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedTier(tier.id)}
                      style={{ animationDelay: `${linkModalStaggerDelay(index)}ms` }}
                      className={[
                        "link-modal-stagger-item link-modal-interactive flex w-full items-center gap-4 rounded-2xl border p-4 text-left",
                        selected
                          ? "border-[#0400FF] bg-[#0400FF]/[0.03] shadow-[0_0_0_1px_rgba(4,0,255,0.08)]"
                          : "border-[#ECECEF] bg-white hover:border-neutral-300",
                      ].join(" ")}
                    >
                      <CardImage
                        src={tier.image}
                        alt={`${tier.name} card`}
                        size="list"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-base font-bold text-[#131520]">
                            {tier.name}
                          </span>
                          {tier.premium ? (
                            <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                              Premium
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-[#6A6D81]">
                          {tier.description}
                        </span>
                      </span>
                      <RadioIndicator selected={selected} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {!connecting ? (
          <div
            className="link-modal-stagger-item flex shrink-0 items-center justify-end gap-3 border-t border-[#ECECEF]/80 px-6 py-4"
            style={{ animationDelay: `${linkModalStaggerDelay(CARD_TIERS.length)}ms` }}
          >
            <button
              type="button"
              onClick={onClose}
              className="link-modal-interactive rounded-xl border border-[#ECECEF] px-5 py-2.5 text-sm font-semibold text-[#131520] hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onContinue(selectedTier)}
              className="link-modal-interactive rounded-xl bg-[#0400FF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1a33e6]"
            >
              Continue
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
