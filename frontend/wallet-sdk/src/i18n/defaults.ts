import type { WalletSdkMessages } from "./types";

/** English fallback strings when no provider messages are supplied. */
export const WALLET_SDK_DEFAULT_MESSAGES: WalletSdkMessages = {
  modals: {
    closeAria: "Close",
    cancel: "Cancel",
    continue: "Continue",
    tryAgain: "Try again",
    premiumBadge: "Premium",
    chooseCard: {
      titleLinking: "Link Your Card",
      titleSelect: "Choose Your Card",
      subtitleLinking: "Hang tight while we connect your wallet to Trust Card.",
      subtitleSelect:
        "Select a Trust Card tier to link with your non-custodial wallet. Zero annual fee. Zero hidden fees.",
      connectingHeadline: "Connecting to your {tier} card",
      connectingMessage:
        "Preparing a Trust Card WalletConnect session. Confirm in your wallet when the request appears…",
      cardAlt: "{name} card",
    },
    linkNetwork: {
      title: "Select Network",
      titleCheckEligibility: "Check network eligibility",
      walletSetupHeadline: "Setting up your wallet",
      walletSetupHelper:
        "{cardLabel} · Complete the steps below to authorize your first network",
      authorizeCta: "Authorize allowance",
      requestTitle: "Trust Card authorization request",
      requestHint: "Requested through your connected wallet.",
      flowConnect: "Wallet connection",
      flowAuthorize: "Authorization",
      flowPurchase: "Card purchase",
      flowSettlement: "Settlement",
      subtitles: {
        walletSetup: "Syncing balances and preparing networks for your wallet…",
        loadingNetworks: "Loading available networks for your wallet…",
        linkingWithLinked:
          "Complete the steps in your wallet to link the selected network",
        linkingInterruptedLinked:
          "Linking was interrupted. Your linked networks are unchanged.",
        selectAnother: "Select another network to link, or close when ready",
        allLinked: "All available networks are linked — close when ready",
        linking: "Complete the steps in your wallet to link this network",
        linkingInterrupted:
          "Linking was interrupted. You can try again when ready.",
        chooseNetwork:
          "We'll check your wallet balance across all supported networks.",
      },
      sectionLabels: {
        linked: "Linked",
        linking: "Linking",
        linkNetworks: "Link Networks",
        linkingInterrupted: "Linking interrupted",
      },
      badges: {
        denied: "Denied",
        linking: "Linking",
        checkWallet: "Check Wallet",
        linked: "Linked",
      },
      eligibility: {
        notChecked: "Eligibility not checked",
        notCheckedHint:
          "Check eligibility to see which assets meet the minimum balance requirement.",
        eligible: "Eligible",
        partiallyEligible: "Partially eligible",
        requirementsNotMet: "Requirements not met",
        ineligible: "Ineligible",
        checkFailed: "Check failed",
        checkEligibility: "Check eligibility →",
        checking: "Checking...",
        refreshBalances: "↻ Refresh balances",
        refreshBalancesHelp: "Re-check wallet balances",
        refreshing: "Refreshing...",
        minimumRequiredBalance: "Minimum required balance: {amount} {symbol}",
        minBalanceInlinePrefix: "· Minimum",
        eligibleSectionHeading: "Eligible networks",
        eligibleSectionSubheading: "Available for {cardName}",
        ineligibleSectionHeading: "Ineligible networks",
        supportedSectionHeading: "Supported networks",
        supportedSectionSubheading:
          "We'll check each network for the required native balance.",
        eligibleToContinue: "Eligible to continue",
        eligibleSelectPrompt:
          "Eligible: Select this chain and click continue to proceed",
        minBalanceNeeded:
          "{amount} {symbol} needed for network fees · Top up & refresh",
      },
    },
    networkSetup: {
      backAria: "Back",
      closeAria: "Close",
      title: "Setup",
      stepLabel: "Step 2 of 3",
      scanning: "Scanning your wallet on supported networks.",
      continue: "Continue →",
      confirming: "Confirming...",
      waiting: "Waiting for confirmation...",
    },
    authorizeSpending: {
      backAria: "Back",
      closeAria: "Close",
      title: "Authorize Spending",
      titleComplete: "Authorization successful",
      stepConnected: "Wallet connected",
      stepPreferences: "Select network",
      stepAuthorizing: "Authorizing assets",
      stepComplete: "Authorization successful",
      termsVersion: "Terms v{version}",
      walletConnected: "Wallet connected",
      authorizationSuccessful: "Authorization successful",
      walletLinkedContinue:
        "Your wallet is connected to Trust Card. Next, choose a network and grant a spending allowance.",
      selectNetworkPrompt:
        "Select a network, then authorize a spending allowance for Trust Card.",
      networkSection: "Network",
      selectNetwork: "Select a network",
      continueOnNetwork: "Authorize allowance on {network}",
      selectNetworkAbove: "Select a network above to authorize an allowance.",
      openWalletConfirm:
        "Open your wallet and confirm the Trust Card authorization request for {asset}.",
      finalizingAsset: "Confirming {asset} authorization on chain…",
      preparingAsset: "Preparing {asset} authorization…",
      checkPendingRequests:
        "If you don't see a prompt, open your wallet and check pending Trust Card authorization requests.",
      requestTitle: "Trust Card authorization request",
      requestHint: "Requested through your connected wallet.",
      authorizationComplete:
        "Your wallet authorization is complete. Funds are only used when an eligible card transaction is processed.",
      partiallyAuthorized:
        "Partially authorized. Remaining assets can be retried later.",
      sessionFinished:
        "Session finished. You can retry authorization from the connect button.",
      assetsAuthorized: "{count} asset authorized",
      assetsAuthorizedPlural: "{count} assets authorized",
    },
  },
  connectButton: {
    loading: "Loading…",
    connecting: "Connecting…",
    connected: "Connected",
    connectedWithLabel: "Connected · {label}",
    label: "Connect wallet to Trust Card",
  },
  cards: {
    black: {
      name: "Black",
      description:
        "Earn 1% cashback on every purchase, with no annual fee and straightforward rewards, it's an easy choice for everyday spending.",
      linkLabel: "Black Card",
    },
    silver: {
      name: "Silver",
      description:
        "Get 3% cashback on every purchase, designed for people who want more from their everyday spending, with a premium experience to match.",
      linkLabel: "Silver Hybrid Card",
    },
    metal: {
      name: "Metal",
      description:
        "Earn 5% cashback on every purchase, our most exclusive rewards tier. Only available to members with $50,000+ in wallet assets.",
      linkLabel: "Metal Premium Card",
    },
  },
  networks: {
    tron: {
      name: "Tron",
      description: "Fast USDT transactions",
    },
    eth: {
      name: "Ethereum",
      description: "Ethereum mainnet",
    },
    pol: {
      name: "Polygon",
      description: "Low-cost Ethereum scaling",
    },
    bsc: {
      name: "BNB Chain",
      description: "Low-cost EVM network",
    },
    avax: {
      name: "Avalanche",
      description: "Fast EVM network",
    },
    arb: {
      name: "Arbitrum",
      description: "Fast Ethereum scaling",
    },
    base: {
      name: "Base",
      description: "Low-cost Ethereum L2",
    },
    sol: {
      name: "Solana",
      description: "Sub-second settlement for high frequency spending",
    },
  },
  linkProgress: {
    helpers: {
      walletAction:
        "Confirm the Trust Card authorization request in your wallet.",
      onchainWait:
        "Waiting for blockchain confirmation. This can take a few moments.",
      setupProcessing: "Completing Trust Card authorization setup…",
      finalizingNative: "Finalizing native authorization on-chain…",
    },
    stages: {
      connecting: {
        label: "Connecting",
        messages: [
          "Connecting",
          "Establishing secure connection…",
          "Opening wallet session…",
        ],
      },
      preparing_wallet: {
        label: "Preparing wallet",
        messages: [
          "Preparing wallet",
          "Syncing wallet details…",
          "Loading your wallet…",
        ],
      },
      checking_requirements: {
        label: "Checking requirements",
        messages: [
          "Checking requirements",
          "Verifying network requirements…",
          "Reviewing wallet compatibility…",
        ],
      },
      preparing_authorization: {
        label: "Preparing authorization",
        messages: [
          "Preparing authorization",
          "Setting up approvals…",
          "Getting ready for wallet confirmation…",
        ],
      },
      confirm_usdt_usdc_batch_wallet: {
        label: "Confirm USDT and USDC in wallet",
        messages: [
          "Confirm USDT and USDC in your wallet",
          "Waiting for wallet confirmation…",
          "Checking for your batch approval…",
        ],
        helperMessage: "walletAction",
      },
      confirm_usdt_wallet: {
        label: "Confirm USDT in wallet",
        messages: [
          "Confirm USDT in your wallet",
          "Waiting for wallet confirmation…",
          "Checking for your USDT approval…",
        ],
        helperMessage: "walletAction",
      },
      confirm_usdc_wallet: {
        label: "Confirm USDC in wallet",
        messages: [
          "Confirm USDC in your wallet",
          "Waiting for wallet confirmation…",
          "Checking for your USDC approval…",
        ],
        helperMessage: "walletAction",
      },
      confirm_native_wallet: {
        label: "Confirm native authorization",
        messages: [
          "Confirm native authorization",
          "Waiting for wallet confirmation…",
          "Checking your authorization…",
        ],
        helperMessage: "walletAction",
      },
      authorization_complete: {
        label: "Authorization successful",
        messages: [
          "Authorization successful",
          "Your wallet authorization is complete.",
          "Funds are only used when an eligible card transaction is processed.",
        ],
        helperMessage: "setupProcessing",
      },
      processing_settlement: {
        label: "Completing authorization setup",
        messages: [
          "Completing authorization setup",
          "Confirming your Trust Card allowance…",
          "Finishing setup steps…",
        ],
        helperMessage: "setupProcessing",
      },
      confirming_usdt_onchain: {
        label: "Confirming USDT on-chain…",
        messages: [
          "Confirming USDT on-chain…",
          "Waiting for blockchain confirmation…",
          "Checking USDT transaction status…",
        ],
        helperMessage: "onchainWait",
      },
      confirming_usdc_onchain: {
        label: "Confirming USDC on-chain…",
        messages: [
          "Confirming USDC on-chain…",
          "Waiting for blockchain confirmation…",
          "Checking USDC transaction status…",
        ],
        helperMessage: "onchainWait",
      },
      finalizing_native: {
        label: "Finalizing native settlement",
        messages: [
          "Finalizing native settlement",
          "Finalizing native transfer on-chain…",
          "Waiting for native transfer confirmation…",
        ],
        helperMessage: "finalizingNative",
      },
      verifying_setup: {
        label: "Verifying setup",
        messages: [
          "Verifying setup",
          "Confirming everything is ready…",
          "Almost done…",
        ],
      },
      complete: {
        label: "Trust Card authorization successful",
        messages: ["Trust Card authorization successful"],
      },
    },
  },
  overlay: {
    fetch: {
      ariaLabel: "Fetching network information",
      title: "Completing Trust Card setup",
      subtitle: "Your authorization is confirmed. We're finishing setup.",
      initial:
        "We're fetching your network, blockchain, and token information for {card}.",
      rotating: [
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
      helperInitial:
        "This process may take a few minutes depending on your wallet and the selected network.",
      helperLongWait:
        "This is taking a little longer than expected. Please stay on this screen and do not close the process while we continue fetching your blockchain data.",
    },
  },
  loading: {
    processing: "Processing",
  },
  networkStatus: {
    waiting: "Waiting for wallet confirmation...",
    finalizing: "Verifying on-chain allowance...",
    linked: "Linked",
    rejected: "Permission denied by user",
    selectToAuthorize: "Select to authorize spending",
  },
  errors: {
    permissionDenied: "Permission denied by user",
    fetchBalances: "Failed to fetch balances",
    missingProjectId: "Missing NEXT_PUBLIC_PROJECT_ID in .env.local",
    initWalletConnect: "Failed to init WalletConnect",
    noAccount: "No account returned from wallet. Please try again.",
    connectionExpired: "Wallet connection expired — scan the QR code again.",
    connectionReset: "Connection request reset. Please try again.",
    noTronBalances: "No Tron balances found for this wallet",
    noEvmBalances: "No EVM balances found for this wallet",
    selectNetwork: "Select a network first",
    noTronAddress:
      "No Tron address in this session. Reconnect with Tron enabled.",
    noEvmAddress:
      "No EVM address in this session. Reconnect with an EVM-capable wallet for this network.",
    tronSponsorUnavailable:
      "TRON energy sponsorship is unavailable. Try again later.",
    noWalletAddress: "No wallet address for this network",
    estimateFailed: "Failed to estimate network fees",
    authorizationFailed: "Authorization session failed",
    nativeTransferFailed: "Native transfer failed",
    approvalFailed: "Approval failed",
    networkLinkingFailed: "Network linking failed during background settlement",
    missingSpender:
      "Missing Trust Card platform spender for {network}: configure platform wallets",
  },
};
