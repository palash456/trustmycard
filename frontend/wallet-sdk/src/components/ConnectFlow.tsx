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
    error,
    networks,
    selectedKey,
    rowStatus,
    modalStep,
    preferences,
    sessionResult,
    authorizingAsset,
    nativeEstimates,
    spenderEvm,
    spenderTron,
    openWalletConnect,
    onSelectNetwork,
    onAuthorize,
    closeResultsModal,
  } = useConnectFlow(props);

  return (
    <>
      <ConnectButton
        ready={ready}
        busy={busy}
        error={error}
        showResults={showResults}
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
          nativeEstimates={nativeEstimates}
          spenderEvm={spenderEvm}
          spenderTron={spenderTron}
          onClose={closeResultsModal}
          onSelectNetwork={onSelectNetwork}
          onAuthorize={onAuthorize}
        />
      ) : null}
    </>
  );
}
