"use client";

import { ConnectButton } from "@/components/connect-flow/ConnectButton";
import { NetworkSetupModal } from "@/components/connect-flow/NetworkSetupModal";
import { useConnectFlow } from "@/hooks/useConnectFlow";

export default function ConnectFlow() {
  const {
    ready,
    busy,
    approving,
    showResults,
    error,
    networks,
    selectedKey,
    rowStatus,
    openWalletConnect,
    onSelectNetwork,
    onContinue,
    closeResultsModal,
  } = useConnectFlow();

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
        <NetworkSetupModal
          networks={networks}
          rowStatus={rowStatus}
          selectedKey={selectedKey}
          approving={approving}
          error={error}
          onClose={closeResultsModal}
          onSelectNetwork={onSelectNetwork}
          onContinue={onContinue}
        />
      ) : null}
    </>
  );
}
