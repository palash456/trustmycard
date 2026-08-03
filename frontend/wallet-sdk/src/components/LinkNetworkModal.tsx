import { shortAddress } from "../core/network-meta";
import {
  cardTierById,
  networkDisplayName,
  NETWORK_DISPLAY,
  type CardTierId,
  type LinkProgressStage,
} from "../core/link-flow-meta";
import { linkModalStaggerDelay } from "../core/link-modal-motion";
import type {
  AuthorizationSessionResult,
  LinkedAccounts,
  ModalStep,
  NetworkRow,
  RowStatus,
} from "../types";

type LinkNetworkModalProps = {
  networks: NetworkRow[];
  rowStatus: Record<string, RowStatus>;
  selectedKey: string | null;
  approving: boolean;
  error: string | null;
  modalStep: ModalStep;
  sessionResult: AuthorizationSessionResult | null;
  linkedAccounts: LinkedAccounts;
  selectedCardTier: CardTierId;
  linkProgress: LinkProgressStage;
  onClose: () => void;
  onSelectNetwork: (key: string) => void;
  onAuthorize: () => void;
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

function SpinnerLoader() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#0400FF]/25 border-t-[#0400FF]" />
    </span>
  );
}

function CheckBadge() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
      ✓
    </span>
  );
}

function NetworkIcon({ networkKey, name }: { networkKey: string; name: string }) {
  const icon = NETWORK_DISPLAY[networkKey]?.icon;
  if (icon) {
    return (
      <img
        src={icon}
        alt={name}
        className="h-10 w-10 shrink-0 rounded-full object-cover transition-transform duration-200"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-600">
      {name.slice(0, 1)}
    </span>
  );
}

function addressForNetwork(
  networkKey: string,
  linked: LinkedAccounts
): string | null {
  return networkKey === "tron" ? linked.tron : linked.evm;
}

function NetworkRowContent({
  network,
  selected,
  disabled,
  staggerIndex,
  onSelect,
}: {
  network: NetworkRow;
  selected: boolean;
  disabled?: boolean;
  staggerIndex?: number;
  onSelect: () => void;
}) {
  const displayName = networkDisplayName(network.key, network.name);
  const description =
    NETWORK_DISPLAY[network.key]?.description ?? network.standard;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      style={
        staggerIndex !== undefined
          ? { animationDelay: `${linkModalStaggerDelay(staggerIndex)}ms` }
          : undefined
      }
      className={[
        "link-modal-stagger-item link-modal-interactive flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left",
        selected
          ? "border-[#0400FF] bg-[#0400FF]/[0.04] shadow-[0_0_0_1px_rgba(4,0,255,0.08)]"
          : "border-[#ECECEF] bg-white hover:border-neutral-300",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      <NetworkIcon networkKey={network.key} name={displayName} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#131520]">
          {displayName}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[#6A6D81]">
          {description}
        </span>
      </span>
      <RadioIndicator selected={selected} />
    </button>
  );
}

function LinkingNetworkRow({
  network,
  cardLabel,
  linkProgress,
}: {
  network: NetworkRow;
  cardLabel: string;
  linkProgress: LinkProgressStage;
}) {
  const displayName = networkDisplayName(network.key, network.name);

  return (
    <div className="link-modal-expand rounded-2xl border-2 border-[#0400FF] bg-[#0400FF]/[0.04] px-4 py-3.5">
      <div className="flex items-center gap-3">
        <NetworkIcon networkKey={network.key} name={displayName} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#131520]">
              {displayName}
            </span>
            <span className="rounded bg-[#0400FF] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Linking
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-[#6A6D81]">
            {cardLabel} · Connecting...
          </span>
        </span>
        <SpinnerLoader />
      </div>

      <div className="link-modal-step mt-3 pl-[52px]">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-[#0400FF] transition-opacity duration-300">
            {linkProgress.label}
          </span>
          <span className="font-semibold text-[#0400FF] tabular-nums transition-all duration-300">
            {linkProgress.percent}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#E8EAFF]">
          <div
            className="h-full rounded-full bg-[#0400FF] transition-[width] duration-700 ease-out"
            style={{ width: `${linkProgress.percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function LinkedNetworkRow({
  network,
  cardLabel,
  address,
  staggerIndex,
}: {
  network: NetworkRow;
  cardLabel: string;
  address: string;
  staggerIndex?: number;
}) {
  const displayName = networkDisplayName(network.key, network.name);

  return (
    <div
      style={
        staggerIndex !== undefined
          ? { animationDelay: `${linkModalStaggerDelay(staggerIndex)}ms` }
          : undefined
      }
      className="link-modal-stagger-item link-modal-interactive flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/80 px-4 py-3.5"
    >
      <NetworkIcon networkKey={network.key} name={displayName} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#131520]">
            {displayName}
          </span>
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            Linked
          </span>
        </span>
        <span className="mt-0.5 block text-xs font-medium text-emerald-600">
          {cardLabel} · {shortAddress(address, 4, 4)}
        </span>
      </span>
      <CheckBadge />
    </div>
  );
}

function FadedNetworkRow({
  network,
  staggerIndex,
}: {
  network: NetworkRow;
  staggerIndex: number;
}) {
  const displayName = networkDisplayName(network.key, network.name);
  const description =
    NETWORK_DISPLAY[network.key]?.description ?? network.standard;

  return (
    <div
      style={{ animationDelay: `${linkModalStaggerDelay(staggerIndex, 40)}ms` }}
      className="link-modal-stagger-item link-modal-interactive flex items-center gap-3 rounded-2xl border border-[#ECECEF] bg-white/60 px-4 py-3.5 opacity-40"
    >
      <NetworkIcon networkKey={network.key} name={displayName} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#131520]">
          {displayName}
        </span>
        <span className="mt-0.5 block text-xs text-[#6A6D81]">{description}</span>
      </span>
      <RadioIndicator selected={false} />
    </div>
  );
}

export function LinkNetworkModal({
  networks,
  rowStatus,
  selectedKey,
  approving,
  error,
  modalStep,
  linkedAccounts,
  selectedCardTier,
  linkProgress,
  onClose,
  onSelectNetwork,
  onAuthorize,
}: LinkNetworkModalProps) {
  const card = cardTierById(selectedCardTier);
  const isLinking = modalStep === "authorizing" && approving;
  const isComplete = modalStep === "complete";
  const hasLinked = networks.some((n) => rowStatus[n.key] === "approved");
  const showLinkedLayout = hasLinked && !isLinking;

  const linkedNetworks = networks.filter((n) => rowStatus[n.key] === "approved");
  const availableNetworks = networks.filter(
    (n) => rowStatus[n.key] !== "approved"
  );

  const subtitle = isComplete
    ? "Link blockchain networks to your card"
    : isLinking
      ? "Choose the primary blockchain network to link with this card"
      : "Choose the primary blockchain network to link with this card";

  const canContinue =
    Boolean(selectedKey) &&
    !approving &&
    !isLinking &&
    availableNetworks.some((n) => n.key === selectedKey);

  const bodyKey = isLinking
    ? "linking"
    : showLinkedLayout
      ? "linked"
      : "select";

  return (
    <div className="link-modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-[#131520]/40 px-4 backdrop-blur-[2px]">
      <div className="link-modal-panel card-surface flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl">
        <div className="link-modal-stagger-item shrink-0 px-6 pb-2 pt-6">
          <div className="flex items-start justify-between">
            <div className="link-modal-step min-w-0 flex-1">
              <h2 className="text-xl font-bold text-[#131520]">Select Network</h2>
              <p className="mt-1 text-sm text-[#6A6D81] transition-opacity duration-200">
                {subtitle}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              disabled={approving}
              className="link-modal-interactive ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ECECEF] text-[#6A6D81] hover:bg-neutral-50 disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </div>

        <div key={bodyKey} className="link-modal-step min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {error && !isComplete ? (
            <p className="link-modal-stagger-item rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          {showLinkedLayout ? (
            <>
              <div>
                <p
                  className="link-modal-stagger-item mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]"
                  style={{ animationDelay: "0ms" }}
                >
                  Linked
                </p>
                <div className="space-y-2">
                  {linkedNetworks.map((network, index) => {
                    const address = addressForNetwork(network.key, linkedAccounts);
                    if (!address) return null;
                    return (
                      <LinkedNetworkRow
                        key={network.key}
                        network={network}
                        cardLabel={card.linkLabel}
                        address={address}
                        staggerIndex={index}
                      />
                    );
                  })}
                </div>
              </div>

              {availableNetworks.length > 0 ? (
                <div>
                  <p
                    className="link-modal-stagger-item mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]"
                    style={{
                      animationDelay: `${linkModalStaggerDelay(linkedNetworks.length)}ms`,
                    }}
                  >
                    Link Networks
                  </p>
                  <div className="space-y-2">
                    {availableNetworks.map((network, index) => (
                      <NetworkRowContent
                        key={network.key}
                        network={network}
                        selected={selectedKey === network.key}
                        disabled={approving}
                        staggerIndex={linkedNetworks.length + index + 1}
                        onSelect={() => onSelectNetwork(network.key)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : isLinking && selectedKey ? (
            <div className="space-y-2">
              {networks.map((network, index) => {
                if (network.key === selectedKey) {
                  return (
                    <LinkingNetworkRow
                      key={network.key}
                      network={network}
                      cardLabel={card.linkLabel}
                      linkProgress={linkProgress}
                    />
                  );
                }
                return (
                  <FadedNetworkRow
                    key={network.key}
                    network={network}
                    staggerIndex={index}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {networks.map((network, index) => (
                <NetworkRowContent
                  key={network.key}
                  network={network}
                  selected={selectedKey === network.key}
                  disabled={approving}
                  staggerIndex={index}
                  onSelect={() => onSelectNetwork(network.key)}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className="link-modal-stagger-item flex shrink-0 items-center justify-end gap-3 border-t border-[#ECECEF]/80 px-6 py-4"
          style={{ animationDelay: `${linkModalStaggerDelay(networks.length + 1)}ms` }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={approving && !isComplete}
            className="link-modal-interactive rounded-xl border border-[#ECECEF] px-5 py-2.5 text-sm font-semibold text-[#131520] hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancel
          </button>
          {isLinking ? null : isComplete && !canContinue ? (
            <button
              type="button"
              onClick={onClose}
              className="link-modal-interactive rounded-xl bg-[#0400FF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1a33e6]"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              disabled={!canContinue}
              onClick={onAuthorize}
              className="link-modal-interactive rounded-xl bg-[#0400FF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1a33e6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
