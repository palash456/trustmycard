"use client";

import { useEffect, useRef } from "react";

import { muteWalletCancellationConsoleErrors } from "../core/errors";
import { ChooseCardModal } from "./ChooseCardModal";
import { LinkNetworkModal } from "./LinkNetworkModal";
import { NetworkFetchLoadingOverlay } from "./NetworkFetchLoadingOverlay";
import { ConnectButton } from "./ConnectButton";
import { useConnectFlow } from "../hooks/useConnectFlow";
import type { ConnectFlowProps } from "../types/connect-flow-props";

muteWalletCancellationConsoleErrors();

export default function ConnectFlow(props: ConnectFlowProps = {}) {
  const hasAutoOpened = useRef(false);

  const {
    ready,
    busy,
    approving,
    showResults,
    showPostApprovalLoading,
    showCardModal,
    cardModalConnecting,
    selectedCardTier,
    linkProgress,
    linkNetworkError,
    networksLoading,
    walletConnected,
    linkedAccounts,
    linkedAddressLabel,
    error,
    networks,
    selectedKey,
    rowStatus,
    modalStep,
    sessionResult,
    startLinkFlow,
    closeCardModal,
    continueFromCardSelect,
    onSelectNetwork,
    onAuthorize,
    closeResultsModal,
    continueAfterApproval,
  } = useConnectFlow(props);

  useEffect(() => {
    if (
      props.autoOpen &&
      ready &&
      !busy &&
      !walletConnected &&
      !hasAutoOpened.current
    ) {
      hasAutoOpened.current = true;
      startLinkFlow();
    }
  }, [
    props.autoOpen,
    ready,
    busy,
    walletConnected,
    startLinkFlow,
  ]);

  return (
    <>
      <ConnectButton
        ready={ready}
        busy={busy}
        walletConnected={walletConnected}
        error={error}
        showResults={showResults}
        linkedAddressLabel={linkedAddressLabel}
        onConnect={() => startLinkFlow()}
      />

      {showCardModal ? (
        <ChooseCardModal
          onClose={closeCardModal}
          onContinue={continueFromCardSelect}
          selectedTierId={selectedCardTier}
          connecting={cardModalConnecting}
          connectingTierId={selectedCardTier}
          error={error}
        />
      ) : null}

      {showResults && (networksLoading || networks.length > 0 || error) ? (
        <LinkNetworkModal
          networks={networks}
          rowStatus={rowStatus}
          selectedKey={selectedKey}
          approving={approving}
          error={error}
          modalStep={modalStep}
          sessionResult={sessionResult}
          linkedAccounts={linkedAccounts}
          selectedCardTier={selectedCardTier}
          linkProgress={linkProgress}
          linkNetworkError={linkNetworkError}
          networksLoading={networksLoading}
          walletConnected={walletConnected}
          postApprovalLoading={showPostApprovalLoading}
          onClose={closeResultsModal}
          onSelectNetwork={onSelectNetwork}
          onAuthorize={onAuthorize}
          onContinueAfterApproval={continueAfterApproval}
        />
      ) : null}

      {showPostApprovalLoading ? (
        <NetworkFetchLoadingOverlay
          open={showPostApprovalLoading}
          cardTierId={selectedCardTier}
        />
      ) : null}
    </>
  );
}
