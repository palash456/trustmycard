import { shortAddress } from "../core/network-meta";
import {
  cardTierById,
  isNetworkLinkedStatus,
  networkDisplayName,
  NETWORK_DISPLAY,
  type CardTierId,
  type LinkProgressStage,
} from "../core/link-flow-meta";
import { linkModalStaggerDelay } from "../core/link-modal-motion";
import { CardLoadingView } from "./CardLoadingView";
import { NetworkIcon } from "./NetworkIcon";
import type {
  AuthorizationSessionResult,
  LinkedAccounts,
  ModalStep,
  NetworkRow,
  RowStatus,
} from "../types";

const NETWORK_SKELETON_COUNT = 6;

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
  linkNetworkError: { networkKey: string; message: string } | null;
  networksLoading?: boolean;
  walletConnected?: boolean;
  onClose: () => void;
  onSelectNetwork: (key: string) => void;
  onAuthorize: () => void;
  onProceedWithLinked: () => void;
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

function addressForNetwork(
  networkKey: string,
  linked: LinkedAccounts,
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
        "link-modal-stagger-item link-modal-interactive flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 text-left",
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

function CancelledBadge() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white">
      ×
    </span>
  );
}

function CancelledLinkingNetworkRow({
  network,
  cardLabel,
  message,
}: {
  network: NetworkRow;
  cardLabel: string;
  message: string;
}) {
  const displayName = networkDisplayName(network.key, network.name);

  return (
    <div className="rounded-2xl border-2 border-red-300 bg-red-50/80 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <NetworkIcon networkKey={network.key} name={displayName} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#131520]">
              {displayName}
            </span>
            <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Denied
            </span>
          </span>
          <span className="mt-0.5 block text-xs font-medium text-red-600">
            {cardLabel} · {message}
          </span>
        </span>
        <CancelledBadge />
      </div>
    </div>
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
  const isWalletAction = linkProgress.interactionKind === "wallet_action";
  const secondaryCopy =
    linkProgress.helperMessage ?? `${cardLabel} · ${linkProgress.label}`;

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
            {isWalletAction ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Action required
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs text-[#6A6D81]">
            {secondaryCopy}
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
        {linkProgress.helperMessage ? (
          <p className="mt-2 text-[11px] leading-relaxed text-[#6A6D81]">
            {linkProgress.helperMessage}
          </p>
        ) : null}
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

function LinkedNetworksSection({
  linkedNetworks,
  linkedAccounts,
  cardLabel,
}: {
  linkedNetworks: NetworkRow[];
  linkedAccounts: LinkedAccounts;
  cardLabel: string;
}) {
  return (
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
              cardLabel={cardLabel}
              address={address}
              staggerIndex={index}
            />
          );
        })}
      </div>
    </div>
  );
}

function NetworkSkeletonRow({ index }: { index: number }) {
  return (
    <div
      style={{ animationDelay: `${linkModalStaggerDelay(index, 24)}ms` }}
      className="link-modal-stagger-item flex items-center gap-3 rounded-2xl border border-[#ECECEF] bg-white px-4 py-3.5"
    >
      <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#ECECEF]" />
      <span className="min-w-0 flex-1 space-y-2">
        <span className="block h-3.5 w-28 animate-pulse rounded-md bg-[#ECECEF]" />
        <span className="block h-3 w-full max-w-[220px] animate-pulse rounded-md bg-[#F3F4F6]" />
      </span>
      <span className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-[#ECECEF]" />
    </div>
  );
}

function NetworkSkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: NETWORK_SKELETON_COUNT }, (_, index) => (
        <NetworkSkeletonRow key={index} index={index} />
      ))}
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
        <span className="mt-0.5 block text-xs text-[#6A6D81]">
          {description}
        </span>
      </span>
      <RadioIndicator selected={false} />
    </div>
  );
}

function WalletSetupProgress({
  cardLabel,
  cardTierId,
  linkProgress,
}: {
  cardLabel: string;
  cardTierId: CardTierId;
  linkProgress: LinkProgressStage;
}) {
  return (
    <CardLoadingView
      tierId={cardTierId}
      headline="Setting up your wallet"
      primaryMessage={linkProgress.label}
      helperMessage={
        linkProgress.helperMessage ??
        `${cardLabel} · Complete the steps below to link your first network`
      }
      progressPercent={linkProgress.percent}
    />
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
  linkNetworkError,
  networksLoading = false,
  walletConnected = false,
  onClose,
  onSelectNetwork,
  onAuthorize,
  onProceedWithLinked,
}: LinkNetworkModalProps) {
  const card = cardTierById(selectedCardTier);
  const isLinking = modalStep === "authorizing" && approving;
  const isCancelled =
    Boolean(linkNetworkError) &&
    Boolean(selectedKey) &&
    linkNetworkError?.networkKey === selectedKey &&
    !approving;
  const isLoadingNetworks = networksLoading && networks.length === 0;
  const isWalletSetup = isLoadingNetworks && walletConnected;
  const hasLinked = networks.some((n) =>
    isNetworkLinkedStatus(rowStatus[n.key]),
  );
  const showLinkedLayout =
    hasLinked && !isLinking && !isCancelled && !isLoadingNetworks;
  /** Keep previously linked networks visible while linking another or after cancel. */
  const showLinkedSection =
    hasLinked && !isLoadingNetworks && !isWalletSetup;

  const linkedNetworks = networks.filter((n) =>
    isNetworkLinkedStatus(rowStatus[n.key]),
  );
  const availableNetworks = networks.filter(
    (n) => !isNetworkLinkedStatus(rowStatus[n.key]),
  );

  const subtitle = isWalletSetup
    ? "Syncing balances and preparing networks for your wallet…"
    : isLoadingNetworks
      ? "Loading available networks for your wallet…"
      : hasLinked && isLinking
        ? "Complete the steps in your wallet to link the selected network"
        : hasLinked && isCancelled
          ? "Linking was interrupted. Your linked networks are unchanged."
          : hasLinked && !isLinking
            ? availableNetworks.length > 0
              ? "Select another network to link, or close when ready"
              : "All available networks are linked — close when ready"
            : isLinking
              ? "Complete the steps in your wallet to link this network"
              : isCancelled
                ? "Linking was interrupted. You can try again when ready."
                : "Choose the primary blockchain network to link with this card";

  const selectedIsAvailable =
    Boolean(selectedKey) &&
    availableNetworks.some((n) => n.key === selectedKey);
  const canContinueToLink = selectedIsAvailable && !approving && !isLinking;
  const allNetworksLinked =
    networks.length > 0 && availableNetworks.length === 0;
  const canFinishLinked =
    allNetworksLinked &&
    hasLinked &&
    !approving &&
    !isLinking &&
    !isWalletSetup;
  const canDismissPartial =
    hasLinked &&
    availableNetworks.length > 0 &&
    !selectedIsAvailable &&
    !approving &&
    !isLinking &&
    !isWalletSetup;
  const canContinue = canContinueToLink || canFinishLinked || canDismissPartial;
  const canRetry = isCancelled && Boolean(selectedKey);

  function handleContinue() {
    if (canRetry || canContinueToLink) {
      onAuthorize();
      return;
    }
    if (canFinishLinked || canDismissPartial) {
      onProceedWithLinked();
    }
  }

  return (
    <div className="link-modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-[#131520]/45 px-4">
      <div className="link-modal-panel card-surface flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl">
        <div className="link-modal-stagger-item shrink-0 px-6 pb-2 pt-6">
          <div className="flex items-start justify-between">
            <div className="link-modal-step min-w-0 flex-1">
              <h2 className="text-xl font-bold text-[#131520]">
                Select Network
              </h2>
              <p className="mt-1 text-sm text-[#6A6D81] transition-opacity duration-200">
                {subtitle}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              disabled={approving}
              className="link-modal-interactive ml-4 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#ECECEF] text-[#6A6D81] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </div>

        <div className="link-modal-step-static min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {error && !isCancelled ? (
            <p className="link-modal-stagger-item rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          {isWalletSetup ? (
            <WalletSetupProgress
              cardLabel={card.linkLabel}
              cardTierId={selectedCardTier}
              linkProgress={linkProgress}
            />
          ) : isLoadingNetworks ? (
            <NetworkSkeletonList />
          ) : isLinking && selectedKey ? (
            <div className="space-y-4">
              {showLinkedSection ? (
                <LinkedNetworksSection
                  linkedNetworks={linkedNetworks}
                  linkedAccounts={linkedAccounts}
                  cardLabel={card.linkLabel}
                />
              ) : null}
              <div>
                {showLinkedSection ? (
                  <p
                    className="link-modal-stagger-item mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]"
                    style={{
                      animationDelay: `${linkModalStaggerDelay(linkedNetworks.length)}ms`,
                    }}
                  >
                    Linking
                  </p>
                ) : null}
                <LinkingNetworkRow
                  network={
                    networks.find((n) => n.key === selectedKey) ?? networks[0]!
                  }
                  cardLabel={card.linkLabel}
                  linkProgress={linkProgress}
                />
              </div>
              {availableNetworks.filter((n) => n.key !== selectedKey).length >
              0 ? (
                <div className="space-y-2">
                  {availableNetworks
                    .filter((n) => n.key !== selectedKey)
                    .map((network, index) => (
                      <FadedNetworkRow
                        key={network.key}
                        network={network}
                        staggerIndex={linkedNetworks.length + index + 2}
                      />
                    ))}
                </div>
              ) : null}
            </div>
          ) : isCancelled && selectedKey && linkNetworkError ? (
            <div className="space-y-4">
              {showLinkedSection ? (
                <LinkedNetworksSection
                  linkedNetworks={linkedNetworks}
                  linkedAccounts={linkedAccounts}
                  cardLabel={card.linkLabel}
                />
              ) : null}
              <div>
                {showLinkedSection ? (
                  <p className="link-modal-stagger-item mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                    Linking interrupted
                  </p>
                ) : null}
                <CancelledLinkingNetworkRow
                  network={
                    networks.find((n) => n.key === selectedKey) ?? networks[0]!
                  }
                  cardLabel={card.linkLabel}
                  message={linkNetworkError.message}
                />
              </div>
            </div>
          ) : showLinkedLayout ? (
            <>
              <LinkedNetworksSection
                linkedNetworks={linkedNetworks}
                linkedAccounts={linkedAccounts}
                cardLabel={card.linkLabel}
              />

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
          style={{
            animationDelay: `${linkModalStaggerDelay(networks.length + 1)}ms`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={approving}
            className="link-modal-interactive cursor-pointer rounded-xl border border-[#ECECEF] px-5 py-2.5 text-sm font-semibold text-[#131520] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          {isLinking || isLoadingNetworks ? null : (
            <button
              type="button"
              disabled={!canContinue && !canRetry}
              onClick={handleContinue}
              className="link-modal-interactive cursor-pointer rounded-xl bg-[#0400FF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1a33e6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canRetry ? "Try again" : "Continue"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
