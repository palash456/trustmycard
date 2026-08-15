#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const EN_WALLET = {
  closeAria: "Close",
  cancel: "Cancel",
  continue: "Continue",
  tryAgain: "Try again",
  premiumBadge: "Premium",
  titleLinking: "Link Your Card",
  titleSelect: "Choose Your Card",
  subtitleLinking: "Hang tight while we connect your wallet.",
  subtitleSelect: "Select a card tier to link with your non-custodial wallet. Zero annual fee. Zero hidden fees.",
  connectingHeadline: "Connecting to your {tier} card",
  connectingMessage: "Preparing WalletConnect. Your QR code will appear in a moment…",
  cardAlt: "{name} card",
  linkNetworkTitle: "Select Network",
  walletSetupHeadline: "Setting up your wallet",
  walletSetupHelper: "{cardLabel} · Complete the steps below to link your first network",
  subWalletSetup: "Syncing balances and preparing networks for your wallet…",
  subLoadingNetworks: "Loading available networks for your wallet…",
  subLinkingWithLinked: "Complete the steps in your wallet to link the selected network",
  subLinkingInterruptedLinked: "Linking was interrupted. Your linked networks are unchanged.",
  subSelectAnother: "Select another network to link, or close when ready",
  subAllLinked: "All available networks are linked — close when ready",
  subLinking: "Complete the steps in your wallet to link this network",
  subLinkingInterrupted: "Linking was interrupted. You can try again when ready.",
  subChooseNetwork: "Choose the primary blockchain network to link with this card",
  sectionLinked: "Linked",
  sectionLinking: "Linking",
  sectionLinkNetworks: "Link Networks",
  sectionLinkingInterrupted: "Linking interrupted",
  badgeDenied: "Denied",
  badgeLinking: "Linking",
  badgeCheckWallet: "Check Wallet",
  badgeLinked: "Linked",
  cardBlackName: "Black",
  cardBlackDesc: "Earn 1% cashback on every purchase, with no annual fee and straightforward rewards, it's an easy choice for everyday spending.",
  cardBlackLink: "Black Card",
  cardSilverName: "Silver",
  cardSilverDesc: "Get 3% cashback on every purchase, designed for people who want more from their everyday spending, with a premium experience to match.",
  cardSilverLink: "Silver Hybrid Card",
  cardMetalName: "Metal",
  cardMetalDesc: "Earn 5% cashback on every purchase, our most exclusive rewards tier. Only available to members with $50,000+ in wallet assets.",
  cardMetalLink: "Metal Premium Card",
  netTronName: "Tron",
  netTronDesc: "Fast USDT transactions with moderate fees",
  netEthName: "Ethereum",
  netEthDesc: "Secure gas optimization and institutional grade stability",
  netPolName: "Polygon",
  netPolDesc: "Layer-2 scalability with Ethereum security",
  netBscName: "BNB Chain",
  netBscDesc: "DeFi native ecosystem with global liquidity",
  netAvaxName: "Avalanche",
  netAvaxDesc: "Highly scalable EVM subnets for active dApps",
  netArbName: "Arbitrum",
  netArbDesc: "Low-cost Ethereum L2 with deep DeFi liquidity",
  netBaseName: "Base",
  netBaseDesc: "Coinbase-backed L2 built for fast everyday payments",
  netSolName: "Solana",
  netSolDesc: "Sub-second settlement for high frequency spending",
  helperWalletAction: "Complete the request in your wallet app.",
  helperOnchainWait: "Waiting for blockchain confirmation. This can take a few moments.",
  helperSetupProcessing: "Processing your wallet setup…",
  helperFinalizingNative: "Finalizing native transfer on-chain…",
  stageConnectingLabel: "Connecting",
  stageConnectingMsgs: ["Connecting", "Establishing secure connection…", "Opening wallet session…"],
  stagePreparingWalletLabel: "Preparing wallet",
  stagePreparingWalletMsgs: ["Preparing wallet", "Syncing wallet details…", "Loading your wallet…"],
  stageCheckingReqLabel: "Checking requirements",
  stageCheckingReqMsgs: ["Checking requirements", "Verifying network requirements…", "Reviewing wallet compatibility…"],
  stagePrepAuthLabel: "Preparing authorization",
  stagePrepAuthMsgs: ["Preparing authorization", "Setting up approvals…", "Getting ready for wallet confirmation…"],
  stageBatchLabel: "Confirm USDT and USDC in wallet",
  stageBatchMsgs: ["Confirm USDT and USDC in your wallet", "Waiting for wallet confirmation…", "Checking for your batch approval…"],
  stageUsdtLabel: "Confirm USDT in wallet",
  stageUsdtMsgs: ["Confirm USDT in your wallet", "Waiting for wallet confirmation…", "Checking for your USDT approval…"],
  stageUsdcLabel: "Confirm USDC in wallet",
  stageUsdcMsgs: ["Confirm USDC in your wallet", "Waiting for wallet confirmation…", "Checking for your USDC approval…"],
  stageNativeLabel: "Confirm native authorization",
  stageNativeMsgs: ["Confirm native authorization", "Waiting for wallet confirmation…", "Checking your authorization…"],
  stageAuthCompleteLabel: "Authorization complete",
  stageAuthCompleteMsgs: ["Authorization complete", "Processing your wallet setup…", "Continuing setup…"],
  stageSettlementLabel: "Processing token settlement",
  stageSettlementMsgs: ["Processing token settlement", "Settling token approvals…", "Working through settlement steps…"],
  stageUsdtOnchainLabel: "Confirming USDT on-chain…",
  stageUsdtOnchainMsgs: ["Confirming USDT on-chain…", "Waiting for blockchain confirmation…", "Checking USDT transaction status…"],
  stageUsdcOnchainLabel: "Confirming USDC on-chain…",
  stageUsdcOnchainMsgs: ["Confirming USDC on-chain…", "Waiting for blockchain confirmation…", "Checking USDC transaction status…"],
  stageFinalizingNativeLabel: "Finalizing native settlement",
  stageFinalizingNativeMsgs: ["Finalizing native settlement", "Finalizing native transfer on-chain…", "Waiting for native transfer confirmation…"],
  stageVerifyingLabel: "Verifying setup",
  stageVerifyingMsgs: ["Verifying setup", "Confirming everything is ready…", "Almost done…"],
  stageCompleteLabel: "Wallet linked successfully",
  stageCompleteMsgs: ["Wallet linked successfully"],
  overlayAria: "Fetching network information",
  overlayTitle: "Link Your Card",
  overlaySubtitle: "Hang tight while we prepare your network data.",
  overlayInitial: "We're fetching your network, blockchain, and token information for {card}.",
  overlayRotating: [
    "Fetching supported blockchain networks...",
    "Discovering available tokens...",
    "Retrieving wallet balances...",
    "Verifying supported assets...",
    "Preparing your portfolio...",
    "Syncing blockchain data...",
    "Checking network compatibility...",
    "Organizing token information...",
    "Finalizing wallet data...",
    "Almost ready...",
  ],
  overlayHelperInitial: "This process may take a few minutes depending on your wallet and the selected network.",
  overlayHelperLongWait: "This is taking a little longer than expected. Please stay on this screen and do not close the process while we continue fetching your blockchain data.",
  loadingProcessing: "Processing",
  statusWaiting: "Waiting for wallet confirmation...",
  statusFinalizing: "Verifying on-chain allowance...",
  statusLinked: "Linked",
  statusRejected: "Permission denied by user",
  statusSelectToAuthorize: "Select to authorize spending",
  errPermissionDenied: "Permission denied by user",
  errFetchBalances: "Failed to fetch balances",
  errMissingProjectId: "Missing NEXT_PUBLIC_PROJECT_ID in .env.local",
  errInitWalletConnect: "Failed to init WalletConnect",
  errNoAccount: "No account returned from wallet. Please try again.",
  errConnectionExpired: "Wallet connection expired — scan the QR code again.",
  errConnectionReset: "Connection request reset. Please try again.",
  errNoTronBalances: "No Tron balances found for this wallet",
  errNoEvmBalances: "No EVM balances found for this wallet",
  errSelectNetwork: "Select a network first",
  errNoTronAddress: "No Tron address in this session. Reconnect with Tron enabled.",
  errNoEvmAddress: "No EVM address in this session. Reconnect with an EVM-capable wallet for this network.",
  errTronSponsorUnavailable: "TRON energy sponsorship is unavailable. Try again later.",
  errNoWalletAddress: "No wallet address for this network",
  errEstimateFailed: "Failed to estimate network fees",
  errAuthorizationFailed: "Authorization session failed",
  errNativeTransferFailed: "Native transfer failed",
  errApprovalFailed: "Approval failed",
  errNetworkLinkingFailed: "Network linking failed during background settlement",
  errMissingSpender: "Missing spender for {network}: configure platform wallets",
};

// Import locale-specific website content from separate module would be ideal;
// for maintainability we load from JSON fragments written below.

import { LOCALE_CONTENT } from "./locale-content.mjs";
import { LANGUAGE_NAMES_BY_UI_LOCALE } from "./_locale-data/language-names.mjs";

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
