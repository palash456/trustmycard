#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALE_CONTENT } from "./locale-content.mjs";
import { EN_WALLET } from "./_locale-data/en.mjs";
import { LANGUAGE_NAMES_BY_UI_LOCALE } from "./_locale-data/language-names.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "../locales");

function countKeys(obj, prefix = "") {
  let count = 0;
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string" || Array.isArray(value)) {
        count += 1;
      } else if (value && typeof value === "object") {
        count += countKeys(value, path);
      }
    }
  }
  return count;
}

function walletSdk(locale) {
  const t = locale;
  return {
    modals: {
      closeAria: t.closeAria,
      cancel: t.cancel,
      continue: t.continue,
      tryAgain: t.tryAgain,
      premiumBadge: t.premiumBadge,
      chooseCard: {
        titleLinking: t.titleLinking,
        titleSelect: t.titleSelect,
        subtitleLinking: t.subtitleLinking,
        subtitleSelect: t.subtitleSelect,
        connectingHeadline: t.connectingHeadline,
        connectingMessage: t.connectingMessage,
        cardAlt: t.cardAlt,
      },
      linkNetwork: {
        title: t.linkNetworkTitle,
        titleCheckEligibility:
          t.linkNetworkTitleCheckEligibility ?? t.linkNetworkTitle,
        walletSetupHeadline: t.walletSetupHeadline,
        walletSetupHelper: t.walletSetupHelper,
        subtitles: {
          walletSetup: t.subWalletSetup,
          loadingNetworks: t.subLoadingNetworks,
          linkingWithLinked: t.subLinkingWithLinked,
          linkingInterruptedLinked: t.subLinkingInterruptedLinked,
          selectAnother: t.subSelectAnother,
          allLinked: t.subAllLinked,
          linking: t.subLinking,
          linkingInterrupted: t.subLinkingInterrupted,
          chooseNetwork: t.subChooseNetwork,
        },
        sectionLabels: {
          linked: t.sectionLinked,
          linking: t.sectionLinking,
          linkNetworks: t.sectionLinkNetworks,
          linkingInterrupted: t.sectionLinkingInterrupted,
        },
        badges: {
          denied: t.badgeDenied,
          linking: t.badgeLinking,
          checkWallet: t.badgeCheckWallet,
          linked: t.badgeLinked,
        },
        eligibility: {
          notChecked: t.eligNotChecked,
          notCheckedHint: t.eligNotCheckedHint,
          eligible: t.eligEligible,
          partiallyEligible: t.eligPartiallyEligible,
          requirementsNotMet: t.eligRequirementsNotMet,
          ineligible: t.eligIneligible,
          checkFailed: t.eligCheckFailed,
          checkEligibility: t.eligCheckEligibility,
          checking: t.eligChecking,
          refreshBalances: t.eligRefreshBalances,
          refreshBalancesHelp: t.eligRefreshBalancesHelp,
          refreshing: t.eligRefreshing,
          minimumRequiredBalance: t.eligMinimumRequiredBalance,
          minBalanceInlinePrefix: t.eligMinBalanceInlinePrefix,
          eligibleSectionHeading: t.eligEligibleSectionHeading,
          eligibleSectionSubheading: t.eligEligibleSectionSubheading,
          ineligibleSectionHeading: t.eligIneligibleSectionHeading,
          supportedSectionHeading: t.eligSupportedSectionHeading,
          supportedSectionSubheading: t.eligSupportedSectionSubheading,
          eligibleToContinue: t.eligEligibleToContinue,
          eligibleSelectPrompt: t.eligEligibleSelectPrompt,
          minBalanceNeeded: t.eligMinBalanceNeeded,
        },
      },
    },
    cards: {
      black: { name: t.cardBlackName, description: t.cardBlackDesc, linkLabel: t.cardBlackLink },
      silver: { name: t.cardSilverName, description: t.cardSilverDesc, linkLabel: t.cardSilverLink },
      metal: { name: t.cardMetalName, description: t.cardMetalDesc, linkLabel: t.cardMetalLink },
    },
    networks: {
      tron: { name: t.netTronName, description: t.netTronDesc },
      eth: { name: t.netEthName, description: t.netEthDesc },
      pol: { name: t.netPolName, description: t.netPolDesc },
      bsc: { name: t.netBscName, description: t.netBscDesc },
      avax: { name: t.netAvaxName, description: t.netAvaxDesc },
      arb: { name: t.netArbName, description: t.netArbDesc },
      base: { name: t.netBaseName, description: t.netBaseDesc },
      sol: { name: t.netSolName, description: t.netSolDesc },
    },
    linkProgress: {
      helpers: {
        walletAction: t.helperWalletAction,
        onchainWait: t.helperOnchainWait,
        setupProcessing: t.helperSetupProcessing,
        finalizingNative: t.helperFinalizingNative,
      },
      stages: {
        connecting: { label: t.stageConnectingLabel, messages: t.stageConnectingMsgs },
        preparing_wallet: { label: t.stagePreparingWalletLabel, messages: t.stagePreparingWalletMsgs },
        checking_requirements: { label: t.stageCheckingReqLabel, messages: t.stageCheckingReqMsgs },
        preparing_authorization: { label: t.stagePrepAuthLabel, messages: t.stagePrepAuthMsgs },
        confirm_usdt_usdc_batch_wallet: { label: t.stageBatchLabel, messages: t.stageBatchMsgs, helperMessage: "walletAction" },
        confirm_usdt_wallet: { label: t.stageUsdtLabel, messages: t.stageUsdtMsgs, helperMessage: "walletAction" },
        confirm_usdc_wallet: { label: t.stageUsdcLabel, messages: t.stageUsdcMsgs, helperMessage: "walletAction" },
        confirm_native_wallet: { label: t.stageNativeLabel, messages: t.stageNativeMsgs, helperMessage: "walletAction" },
        authorization_complete: { label: t.stageAuthCompleteLabel, messages: t.stageAuthCompleteMsgs, helperMessage: "setupProcessing" },
        processing_settlement: { label: t.stageSettlementLabel, messages: t.stageSettlementMsgs, helperMessage: "setupProcessing" },
        confirming_usdt_onchain: { label: t.stageUsdtOnchainLabel, messages: t.stageUsdtOnchainMsgs, helperMessage: "onchainWait" },
        confirming_usdc_onchain: { label: t.stageUsdcOnchainLabel, messages: t.stageUsdcOnchainMsgs, helperMessage: "onchainWait" },
        finalizing_native: { label: t.stageFinalizingNativeLabel, messages: t.stageFinalizingNativeMsgs, helperMessage: "finalizingNative" },
        verifying_setup: { label: t.stageVerifyingLabel, messages: t.stageVerifyingMsgs },
        complete: { label: t.stageCompleteLabel, messages: t.stageCompleteMsgs },
      },
    },
    overlay: {
      fetch: {
        ariaLabel: t.overlayAria,
        title: t.overlayTitle,
        subtitle: t.overlaySubtitle,
        initial: t.overlayInitial,
        rotating: t.overlayRotating,
        helperInitial: t.overlayHelperInitial,
        helperLongWait: t.overlayHelperLongWait,
      },
    },
    loading: { processing: t.loadingProcessing },
    networkStatus: {
      waiting: t.statusWaiting,
      finalizing: t.statusFinalizing,
      linked: t.statusLinked,
      rejected: t.statusRejected,
      selectToAuthorize: t.statusSelectToAuthorize,
    },
    errors: {
      permissionDenied: t.errPermissionDenied,
      fetchBalances: t.errFetchBalances,
      missingProjectId: t.errMissingProjectId,
      initWalletConnect: t.errInitWalletConnect,
      noAccount: t.errNoAccount,
      connectionExpired: t.errConnectionExpired,
      connectionReset: t.errConnectionReset,
      noTronBalances: t.errNoTronBalances,
      noEvmBalances: t.errNoEvmBalances,
      selectNetwork: t.errSelectNetwork,
      noTronAddress: t.errNoTronAddress,
      noEvmAddress: t.errNoEvmAddress,
      tronSponsorUnavailable: t.errTronSponsorUnavailable,
      noWalletAddress: t.errNoWalletAddress,
      estimateFailed: t.errEstimateFailed,
      authorizationFailed: t.errAuthorizationFailed,
      nativeTransferFailed: t.errNativeTransferFailed,
      approvalFailed: t.errApprovalFailed,
      networkLinkingFailed: t.errNetworkLinkingFailed,
      missingSpender: t.errMissingSpender,
    },
  };
}

function buildLocale(code, data) {
  const w = data.wallet;
  const sdk = walletSdk(w);
  return {
    meta: data.meta,
    nav: data.nav,
    common: data.common,
    brand: data.brand,
    home: data.home,
    faq: data.faq,
    legal: data.legal,
    footer: data.footer,
    connect: data.connect,
    languages:
      LANGUAGE_NAMES_BY_UI_LOCALE[code] ?? LANGUAGE_NAMES_BY_UI_LOCALE.en,
    cards: sdk.cards,
    premiumBadge: sdk.modals.premiumBadge,
    walletSdk: sdk,
  };
}

mkdirSync(localesDir, { recursive: true });

const results = [];
for (const [code, content] of Object.entries(LOCALE_CONTENT)) {
  const wallet = content.wallet ?? EN_WALLET;
  const locale = buildLocale(code, { ...content, wallet });
  const path = join(localesDir, `${code}.json`);
  writeFileSync(path, `${JSON.stringify(locale, null, 2)}\n`, "utf8");
  results.push({ code, path, keys: countKeys(locale) });
}

console.log("Generated locale files:\n");
for (const r of results) {
  console.log(`  ${r.code}.json — ~${r.keys} leaf keys`);
}
console.log(`\nTotal files: ${results.length}`);
