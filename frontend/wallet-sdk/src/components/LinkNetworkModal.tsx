"use client";

import type { ReactNode } from "react";
import { shortAddress, nativeSymbolForNetwork } from "../core/network-meta";
import {
  isNetworkLinkedStatus,
  NETWORK_DISPLAY,
  type CardTierId,
  type LinkProgressStage,
} from "../core/link-flow-meta";
import { linkModalStaggerDelay } from "../core/link-modal-motion";
import { useTranslatedLinkProgressDisplayLabel } from "../hooks/useTranslatedLinkProgressDisplayLabel";
import { useWalletSdkCatalog, useWalletSdkT } from "../i18n/context";
import {
  translateWalletError,
  translatedCardTier,
  translatedLinkProgressStage,
  translatedNetworkDescription,
  translatedNetworkName,
} from "../i18n/helpers";
import type { WalletSdkTranslator } from "../i18n/types";
import { CardLoadingView } from "./CardLoadingView";
import { NetworkIcon } from "./NetworkIcon";
import type { NetworkEligibilityResult } from "../eligibility";
import {
  getMinimumBalance,
  isNetworkSelectableForAuthorization,
  sortNetworksByEligibility,
} from "../eligibility";
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
  eligibilityMap?: Record<string, NetworkEligibilityResult> | null;
  eligibilityChecking?: boolean;
  balancesRefreshing?: boolean;
  onCheckEligibility?: () => void;
  onRefreshBalances?: () => void;
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

function EligibilityStatusBadge({
  result,
}: {
  result: NetworkEligibilityResult;
}) {
  const t = useWalletSdkT();

  if (result.status === "INELIGIBLE" || result.status === "ELIGIBLE") {
    return null;
  }

  const config = {
    ELIGIBLE: {
      label: t("modals.linkNetwork.eligibility.eligible"),
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80",
    },
    PARTIALLY_ELIGIBLE: {
      label: t("modals.linkNetwork.eligibility.partiallyEligible"),
      className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/80",
    },
    CHECK_FAILED: {
      label: t("modals.linkNetwork.eligibility.checkFailed"),
      className: "bg-orange-50 text-orange-800 ring-1 ring-orange-200/80",
    },
  }[result.status];

  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        config.className,
      ].join(" ")}
    >
      {config.label}
    </span>
  );
}

function NetworkSummaryLine({
  description,
  networkKey,
  showMinBalance = false,
}: {
  description: string;
  networkKey: string;
  showMinBalance?: boolean;
}) {
  const t = useWalletSdkT();

  if (!showMinBalance) {
    return (
      <span className="mt-1 block text-xs leading-relaxed text-[#6A6D81]">
        {description}
      </span>
    );
  }

  let amount: string | null = null;
  let symbol: string | null = null;
  try {
    amount = getMinimumBalance(networkKey, "native");
    symbol = nativeSymbolForNetwork(networkKey);
  } catch {
    amount = null;
    symbol = null;
  }

  if (!amount || !symbol) {
    return (
      <span className="mt-1 block text-xs leading-relaxed text-[#6A6D81]">
        {description}
      </span>
    );
  }

  return (
    <span className="mt-1 block text-xs leading-relaxed text-[#6A6D81]">
      {description}{" "}
      <span>
        {t("modals.linkNetwork.eligibility.minBalanceInlinePrefix")}{" "}
        <span className="font-semibold text-[#131520]">
          {amount} {symbol}
        </span>
      </span>
    </span>
  );
}

function formatNativeTopUpMessage(
  t: WalletSdkTranslator,
  eligibility: NetworkEligibilityResult,
): string {
  const nativeAsset = eligibility.assets.find(
    (asset) => asset.assetType === "native",
  );
  if (nativeAsset) {
    return t("modals.linkNetwork.eligibility.minBalanceNeeded", {
      amount: nativeAsset.minimumBalance,
      symbol: nativeAsset.symbol,
    });
  }
  return eligibility.detail || eligibility.message;
}

function AlertCircleIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-px h-3 w-3 shrink-0 text-red-400"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-px h-3 w-3 shrink-0 text-emerald-500"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function EligibleSelectMessage() {
  const t = useWalletSdkT();
  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-emerald-200/50 bg-emerald-50/60 px-2 py-1.5">
      <CheckCircleIcon />
      <span className="text-[11px] font-normal leading-snug text-emerald-800/70">
        {t("modals.linkNetwork.eligibility.eligibleSelectPrompt")}
      </span>
    </div>
  );
}

function NativeBalanceNeededMessage({
  eligibility,
}: {
  eligibility: NetworkEligibilityResult;
}) {
  const t = useWalletSdkT();
  const message =
    eligibility.status === "INELIGIBLE"
      ? formatNativeTopUpMessage(t, eligibility)
      : [eligibility.headline, eligibility.detail].filter(Boolean).join(" ");

  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-red-200/50 bg-red-50/60 px-2 py-1.5">
      <AlertCircleIcon />
      <span className="text-[11px] font-normal leading-snug text-red-800/70">
        {message}
      </span>
    </div>
  );
}

function NetworkLinkProgress({
  linkProgress,
  progressLabel,
}: {
  linkProgress: LinkProgressStage;
  progressLabel: string;
}) {
  return (
    <div className="link-modal-step mt-2">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-medium text-[#0400FF] transition-opacity duration-300">
          {progressLabel}
        </span>
        <span className="font-semibold text-[#0400FF] tabular-nums transition-all duration-300">
          {linkProgress.percent}%
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[#E8EAFF]">
        <div
          className="h-full rounded-full bg-[#0400FF] transition-[width] duration-700 ease-out"
          style={{ width: `${linkProgress.percent}%` }}
        />
      </div>
      {linkProgress.helperMessage ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#6A6D81]">
          {linkProgress.helperMessage}
        </p>
      ) : null}
    </div>
  );
}

function EligibilityNetworkCard({
  network,
  selected,
  disabled,
  staggerIndex,
  eligibility,
  linkProgress = null,
  progressLabel,
  onSelect,
}: {
  network: NetworkRow;
  selected: boolean;
  disabled?: boolean;
  staggerIndex?: number;
  eligibility?: NetworkEligibilityResult | null;
  linkProgress?: LinkProgressStage | null;
  progressLabel?: string;
  onSelect: () => void;
}) {
  const t = useWalletSdkT();
  const displayName = translatedNetworkName(t, network.key, network.name);
  const description = translatedNetworkDescription(
    t,
    network.key,
    NETWORK_DISPLAY[network.key]?.description ?? network.standard,
  );
  const eligibilityChecked = eligibility != null;
  const isLinkingThis = linkProgress != null;
  const isEligibleChoice =
    eligibilityChecked &&
    isNetworkSelectableForAuthorization(eligibility) &&
    !isLinkingThis;
  const selectable = isEligibleChoice && !disabled;
  const isIneligibleGroup =
    eligibilityChecked &&
    (eligibility.status === "INELIGIBLE" ||
      eligibility.status === "CHECK_FAILED");
  const showEligibleMessage =
    eligibilityChecked && eligibility.status === "ELIGIBLE" && !isLinkingThis;

  const cardClassName = [
    "link-modal-stagger-item rounded-2xl border px-3.5 transition-colors",
    isEligibleChoice ? "py-5" : "py-3",
    selected || isLinkingThis
      ? "border-[#0400FF]/55 bg-[#0400FF]/[0.03]"
      : "border-[#F0F1F4] bg-white",
    selectable && !disabled ? "hover:border-neutral-200" : "",
    !eligibilityChecked && !disabled && !isLinkingThis
      ? "hover:border-neutral-200"
      : "",
    disabled && !isLinkingThis ? "opacity-50" : "",
    eligibilityChecked && !selectable && !isLinkingThis ? "opacity-95" : "",
  ].join(" ");

  const body = (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-[#131520]">{displayName}</span>
        {eligibilityChecked ? (
          <EligibilityStatusBadge result={eligibility} />
        ) : null}
        {isLinkingThis && linkProgress.interactionKind === "wallet_action" ? (
          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200/80">
            {t("modals.linkNetwork.badges.checkWallet")}
          </span>
        ) : null}
      </span>

      {isLinkingThis ? (
        <NetworkLinkProgress
          linkProgress={linkProgress}
          progressLabel={progressLabel ?? linkProgress.label}
        />
      ) : (
        <>
          <NetworkSummaryLine
            description={description}
            networkKey={network.key}
            showMinBalance={!eligibilityChecked}
          />
          {showEligibleMessage ? (
            <EligibleSelectMessage />
          ) : isIneligibleGroup ? (
            <NativeBalanceNeededMessage eligibility={eligibility} />
          ) : null}
        </>
      )}
    </span>
  );

  const trailingControl = isLinkingThis ? (
    <SpinnerLoader />
  ) : isEligibleChoice ? (
    <RadioIndicator selected={selected} />
  ) : null;

  const content = (
    <>
      <NetworkIcon networkKey={network.key} name={displayName} />
      {body}
      {trailingControl}
    </>
  );

  if (isEligibleChoice) {
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
        className={`${cardClassName} link-modal-interactive flex w-full cursor-pointer items-start gap-3 text-left disabled:cursor-not-allowed`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      style={
        staggerIndex !== undefined
          ? { animationDelay: `${linkModalStaggerDelay(staggerIndex)}ms` }
          : undefined
      }
      className={`${cardClassName} flex items-start gap-3`}
    >
      {content}
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
  const t = useWalletSdkT();
  const displayName = translatedNetworkName(t, network.key, network.name);

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
            {t("modals.linkNetwork.badges.linked")}
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
  const t = useWalletSdkT();

  return (
    <div>
      <p
        className="link-modal-stagger-item mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]"
        style={{ animationDelay: "0ms" }}
      >
        {t("modals.linkNetwork.sectionLabels.linked")}
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

function EligibilityNetworkSkeletonRow({ index }: { index: number }) {
  return (
    <div
      style={{ animationDelay: `${linkModalStaggerDelay(index, 24)}ms` }}
      className="link-modal-stagger-item rounded-2xl border border-[#F0F1F4] bg-white px-3.5 py-3"
    >
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#ECECEF]" />
        <span className="min-w-0 flex-1 space-y-2">
          <span className="flex items-center gap-2">
            <span className="block h-3.5 w-24 animate-pulse rounded-md bg-[#ECECEF]" />
            <span className="block h-4 w-14 animate-pulse rounded-full bg-[#ECECEF]" />
          </span>
          <span className="block h-3 w-full max-w-[300px] animate-pulse rounded-md bg-[#F3F4F6]" />
        </span>
        <span className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-[#ECECEF]" />
      </div>
    </div>
  );
}

function EligibilityNetworkSkeletonList({ count }: { count: number }) {
  const rowCount = Math.max(count, 3);
  return (
    <div className="space-y-2">
      {Array.from({ length: rowCount }, (_, index) => (
        <EligibilityNetworkSkeletonRow key={index} index={index} />
      ))}
    </div>
  );
}

function EligibilitySectionHeading({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="mb-2">
      <p className="text-[13px] font-medium text-[#3F4254]">{children}</p>
      {subtitle ? (
        <p className="mt-0.5 text-[11px] font-normal text-[#9CA3AF]">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function EligibilityCheckedNetworkSections({
  networks,
  eligibilityMap,
  cardLabel,
  selectedKey,
  disabled,
  onSelectNetwork,
  startStaggerIndex = 0,
  linkingNetworkKey = null,
  linkProgress = null,
  progressLabel,
}: {
  networks: NetworkRow[];
  eligibilityMap: Record<string, NetworkEligibilityResult>;
  cardLabel: string;
  selectedKey: string | null;
  disabled?: boolean;
  onSelectNetwork: (key: string) => void;
  startStaggerIndex?: number;
  linkingNetworkKey?: string | null;
  linkProgress?: LinkProgressStage | null;
  progressLabel?: string;
}) {
  const t = useWalletSdkT();
  const eligibleNetworks = networks.filter(
    (network) => eligibilityMap[network.key]?.status === "ELIGIBLE",
  );
  const ineligibleNetworks = networks.filter((network) => {
    const status = eligibilityMap[network.key]?.status;
    return status === "INELIGIBLE" || status === "CHECK_FAILED";
  });

  let staggerIndex = startStaggerIndex;

  return (
    <div className="space-y-4">
      {eligibleNetworks.length > 0 ? (
        <div>
          <EligibilitySectionHeading>
            {t("modals.linkNetwork.eligibility.eligibleSectionHeading")}
          </EligibilitySectionHeading>
          <div className="space-y-3">
            {eligibleNetworks.map((network) => {
              const index = staggerIndex++;
              const isLinkingThis = linkingNetworkKey === network.key;
              return (
                <EligibilityNetworkCard
                  key={network.key}
                  network={network}
                  selected={selectedKey === network.key}
                  disabled={disabled}
                  staggerIndex={index}
                  eligibility={eligibilityMap[network.key] ?? null}
                  linkProgress={isLinkingThis ? linkProgress : null}
                  progressLabel={progressLabel}
                  onSelect={() => onSelectNetwork(network.key)}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {ineligibleNetworks.length > 0 ? (
        <div>
          <EligibilitySectionHeading>
            {t("modals.linkNetwork.eligibility.ineligibleSectionHeading")}
          </EligibilitySectionHeading>
          <div className="space-y-2">
            {ineligibleNetworks.map((network) => {
              const index = staggerIndex++;
              return (
                <EligibilityNetworkCard
                  key={network.key}
                  network={network}
                  selected={false}
                  disabled={disabled}
                  staggerIndex={index}
                  eligibility={eligibilityMap[network.key] ?? null}
                  onSelect={() => onSelectNetwork(network.key)}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NetworkSkeletonRow({ index }: { index: number }) {
  return (
    <div
      style={{ animationDelay: `${linkModalStaggerDelay(index, 24)}ms` }}
      className="link-modal-stagger-item flex items-center gap-3 rounded-2xl border border-[#F0F1F4] bg-white px-3.5 py-3"
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

function WalletSetupProgress({
  cardLabel,
  cardTierId,
  linkProgress,
  progressLabel,
}: {
  cardLabel: string;
  cardTierId: CardTierId;
  linkProgress: LinkProgressStage;
  progressLabel: string;
}) {
  const t = useWalletSdkT();

  return (
    <CardLoadingView
      tierId={cardTierId}
      headline={t("modals.linkNetwork.walletSetupHeadline")}
      primaryMessage={progressLabel}
      helperMessage={
        linkProgress.helperMessage ??
        t("modals.linkNetwork.walletSetupHelper", { cardLabel })
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
  eligibilityMap = null,
  eligibilityChecking = false,
  balancesRefreshing = false,
  onCheckEligibility,
  onRefreshBalances,
  onClose,
  onSelectNetwork,
  onAuthorize,
  onProceedWithLinked,
}: LinkNetworkModalProps) {
  const t = useWalletSdkT();
  const catalog = useWalletSdkCatalog();
  const cardDisplay = translatedCardTier(t, selectedCardTier);
  const translatedProgress = translatedLinkProgressStage(
    t,
    catalog,
    linkProgress,
  );
  const linkProgressDisplayLabel =
    useTranslatedLinkProgressDisplayLabel(linkProgress);
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
  /** Keep previously linked networks visible while linking another or after cancel. */
  const showLinkedSection =
    hasLinked && !isLoadingNetworks && !isWalletSetup;

  const linkedNetworks = networks.filter((n) =>
    isNetworkLinkedStatus(rowStatus[n.key]),
  );
  const availableNetworks = networks.filter(
    (n) => !isNetworkLinkedStatus(rowStatus[n.key]),
  );
  const eligibilityChecked = eligibilityMap !== null;
  const displayNetworks = eligibilityChecked
    ? sortNetworksByEligibility(networks, eligibilityMap!)
    : networks;
  const displayAvailableNetworks = eligibilityChecked
    ? sortNetworksByEligibility(availableNetworks, eligibilityMap!)
    : availableNetworks;

  const subtitle = isWalletSetup
    ? t("modals.linkNetwork.subtitles.walletSetup")
    : isLoadingNetworks
      ? t("modals.linkNetwork.subtitles.loadingNetworks")
      : hasLinked && isLinking
        ? t("modals.linkNetwork.subtitles.linkingWithLinked")
        : hasLinked && isCancelled
          ? t("modals.linkNetwork.subtitles.linkingInterruptedLinked")
          : hasLinked && !isLinking
            ? availableNetworks.length > 0
              ? t("modals.linkNetwork.subtitles.selectAnother")
              : t("modals.linkNetwork.subtitles.allLinked")
            : isLinking
              ? t("modals.linkNetwork.subtitles.linking")
              : isCancelled
                ? t("modals.linkNetwork.subtitles.linkingInterrupted")
                : t("modals.linkNetwork.subtitles.chooseNetwork");

  const selectedIsAvailable =
    Boolean(selectedKey) &&
    availableNetworks.some((n) => n.key === selectedKey);
  const selectedEligibility =
    selectedKey && eligibilityMap ? eligibilityMap[selectedKey] : null;
  const canContinueToLink =
    selectedIsAvailable &&
    !approving &&
    !isLinking &&
    eligibilityChecked &&
    isNetworkSelectableForAuthorization(selectedEligibility);
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
  const needsEligibilityForLinking =
    availableNetworks.length > 0 || (!hasLinked && networks.length > 0);
  const showCheckEligibilityAction =
    !isLinking &&
    !isLoadingNetworks &&
    !isWalletSetup &&
    !eligibilityChecked &&
    needsEligibilityForLinking &&
    !(canFinishLinked || canDismissPartial);

  const eligibilityBusy = eligibilityChecking || balancesRefreshing;
  const showEligibilitySkeleton =
    eligibilityBusy && !isLinking && !isWalletSetup && !isLoadingNetworks;
  const networkListDisabled = approving || eligibilityBusy;
  const linkingNetworkKey = isLinking ? selectedKey : null;
  const bannerError =
    error ?? (isCancelled ? linkNetworkError?.message ?? null : null);

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
                {showCheckEligibilityAction
                  ? t("modals.linkNetwork.titleCheckEligibility")
                  : t("modals.linkNetwork.title")}
              </h2>
              <p className="mt-1 text-sm text-[#6A6D81] transition-opacity duration-200">
                {subtitle}
              </p>
            </div>
            <button
              type="button"
              aria-label={t("modals.closeAria")}
              onClick={onClose}
              disabled={approving}
              className="link-modal-interactive ml-4 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#ECECEF] text-[#6A6D81] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </div>

        <div className="link-modal-step-static min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {bannerError ? (
            <p className="link-modal-stagger-item rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {translateWalletError(t, bannerError)}
            </p>
          ) : null}

          {isWalletSetup ? (
            <WalletSetupProgress
              cardLabel={cardDisplay.linkLabel}
              cardTierId={selectedCardTier}
              linkProgress={translatedProgress}
              progressLabel={linkProgressDisplayLabel}
            />
          ) : isLoadingNetworks ? (
            <NetworkSkeletonList />
          ) : showLinkedSection ? (
            <>
              <LinkedNetworksSection
                linkedNetworks={linkedNetworks}
                linkedAccounts={linkedAccounts}
                cardLabel={cardDisplay.linkLabel}
              />

              {availableNetworks.length > 0 ? (
                <div>
                  {!eligibilityChecked ? (
                    <p
                      className="link-modal-stagger-item mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]"
                      style={{
                        animationDelay: `${linkModalStaggerDelay(linkedNetworks.length)}ms`,
                      }}
                    >
                      {t("modals.linkNetwork.sectionLabels.linkNetworks")}
                    </p>
                  ) : null}
                  {showEligibilitySkeleton ? (
                    <EligibilityNetworkSkeletonList
                      count={displayAvailableNetworks.length}
                    />
                  ) : eligibilityChecked && eligibilityMap ? (
                    <EligibilityCheckedNetworkSections
                      networks={displayAvailableNetworks}
                      eligibilityMap={eligibilityMap}
                      cardLabel={cardDisplay.linkLabel}
                      selectedKey={selectedKey}
                      disabled={networkListDisabled}
                      onSelectNetwork={onSelectNetwork}
                      startStaggerIndex={linkedNetworks.length + 1}
                      linkingNetworkKey={linkingNetworkKey}
                      linkProgress={translatedProgress}
                      progressLabel={linkProgressDisplayLabel}
                    />
                  ) : (
                    <div className="space-y-2">
                      {displayAvailableNetworks.map((network, index) => (
                        <EligibilityNetworkCard
                          key={network.key}
                          network={network}
                          selected={selectedKey === network.key}
                          disabled={networkListDisabled}
                          staggerIndex={linkedNetworks.length + index + 1}
                          eligibility={eligibilityMap?.[network.key] ?? null}
                          linkProgress={
                            linkingNetworkKey === network.key
                              ? translatedProgress
                              : null
                          }
                          progressLabel={linkProgressDisplayLabel}
                          onSelect={() => onSelectNetwork(network.key)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          ) : showEligibilitySkeleton ? (
            <EligibilityNetworkSkeletonList count={displayNetworks.length} />
          ) : eligibilityChecked && eligibilityMap ? (
            <EligibilityCheckedNetworkSections
              networks={displayNetworks}
              eligibilityMap={eligibilityMap}
              cardLabel={cardDisplay.linkLabel}
              selectedKey={selectedKey}
              disabled={networkListDisabled}
              onSelectNetwork={onSelectNetwork}
              linkingNetworkKey={linkingNetworkKey}
              linkProgress={translatedProgress}
              progressLabel={linkProgressDisplayLabel}
            />
          ) : (
            <div className="space-y-2">
              {displayNetworks.map((network, index) => (
                <EligibilityNetworkCard
                  key={network.key}
                  network={network}
                  selected={selectedKey === network.key}
                  disabled={networkListDisabled}
                  staggerIndex={index}
                  eligibility={eligibilityMap?.[network.key] ?? null}
                  linkProgress={
                    linkingNetworkKey === network.key
                      ? translatedProgress
                      : null
                  }
                  progressLabel={linkProgressDisplayLabel}
                  onSelect={() => onSelectNetwork(network.key)}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className="link-modal-stagger-item flex shrink-0 items-center justify-between gap-3 border-t border-[#ECECEF]/80 px-6 py-4"
          style={{
            animationDelay: `${linkModalStaggerDelay(networks.length + 1)}ms`,
          }}
        >
          {isLinking || isLoadingNetworks ? null : showCheckEligibilityAction ? (
            <button
              type="button"
              disabled={eligibilityBusy || networks.length === 0}
              onClick={() => onCheckEligibility?.()}
              className="link-modal-interactive ml-auto shrink-0 cursor-pointer rounded-xl bg-[#0400FF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1a33e6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {eligibilityChecking
                ? t("modals.linkNetwork.eligibility.checking")
                : t("modals.linkNetwork.eligibility.checkEligibility")}
            </button>
          ) : eligibilityChecked ? (
            <>
              <button
                type="button"
                disabled={approving || eligibilityBusy}
                onClick={() => onCheckEligibility?.()}
                className="link-modal-interactive cursor-pointer rounded-lg px-3 py-2 text-[13px] font-medium text-[#6A6D81] hover:bg-neutral-50 hover:text-[#131520] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {eligibilityBusy
                  ? t("modals.linkNetwork.eligibility.refreshing")
                  : t("modals.linkNetwork.eligibility.refreshBalances")}
              </button>
              <button
                type="button"
                disabled={(!canContinueToLink && !canRetry) || eligibilityBusy}
                onClick={handleContinue}
                className="link-modal-interactive shrink-0 cursor-pointer rounded-xl bg-[#0400FF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1a33e6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {canRetry ? t("modals.tryAgain") : `${t("modals.continue")} →`}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={approving}
                className="link-modal-interactive cursor-pointer rounded-xl border border-[#ECECEF] px-5 py-2.5 text-sm font-semibold text-[#131520] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("modals.cancel")}
              </button>
              <button
                type="button"
                disabled={!canContinue && !canRetry}
                onClick={handleContinue}
                className="link-modal-interactive cursor-pointer rounded-xl bg-[#0400FF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1a33e6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {canRetry ? t("modals.tryAgain") : t("modals.continue")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
