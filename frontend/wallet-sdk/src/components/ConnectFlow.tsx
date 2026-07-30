"use client";

import { muteWalletCancellationConsoleErrors } from "../core/errors";
import { AuthorizeSpendingModal } from "./AuthorizeSpendingModal";
import { ConnectButton } from "./ConnectButton";
import { useConnectFlow } from "../hooks/useConnectFlow";
import type { ConnectFlowProps } from "../types/connect-flow-props";

muteWalletCancellationConsoleErrors();

export default function ConnectFlow(props: ConnectFlowProps = {}) {
  const {
    ready,
    busy,
    approving,
    showResults,
    walletConnected,
    linkedAddressLabel,
    error,
    networks,
    selectedKey,
    rowStatus,
    modalStep,
    preferences,
    sessionResult,
    authorizingAsset,
    authorizingPhase,
    authorizingProgress,
    nativeEstimates,
    spenderEvm,
    spenderTron,
    openWalletConnect,
    onSelectNetwork,
    continueFromConnected,
    onAuthorize,
    closeResultsModal,
  } = useConnectFlow(props);

  return (
    <>
      <ConnectButton
        ready={ready}
        busy={busy}
        walletConnected={walletConnected}
        error={error}
        showResults={showResults}
        linkedAddressLabel={linkedAddressLabel}
        onConnect={() => void openWalletConnect()}
      />

      {showResults && networks.length > 0 ? (
        <AuthorizeSpendingModal
          networks={networks}
          rowStatus={rowStatus}
          selectedKey={selectedKey}
          approving={approving}
          error={error}
          modalStep={modalStep}
          preferences={preferences}
          sessionResult={sessionResult}
          authorizingAsset={authorizingAsset}
          authorizingPhase={authorizingPhase}
          authorizingProgress={authorizingProgress}
          linkedAddressLabel={linkedAddressLabel}
          nativeEstimates={nativeEstimates}
          spenderEvm={spenderEvm}
          spenderTron={spenderTron}
          onClose={closeResultsModal}
          onSelectNetwork={onSelectNetwork}
          onContinueFromConnected={continueFromConnected}
          onAuthorize={onAuthorize}
        />
      ) : null}
    </>
  );
}
