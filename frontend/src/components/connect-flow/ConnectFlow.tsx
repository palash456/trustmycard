"use client";

import { AuthorizeSpendingModal } from "@/components/connect-flow/AuthorizeSpendingModal";
import { ConnectButton } from "@/components/connect-flow/ConnectButton";
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
    token,
    amountHuman,
    unlimited,
    termsAccepted,
    openWalletConnect,
    onSelectNetwork,
    onTokenChange,
    onAmountChange,
    onUnlimitedChange,
    onTermsChange,
    onAuthorize,
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
        <AuthorizeSpendingModal
          networks={networks}
          rowStatus={rowStatus}
          selectedKey={selectedKey}
          approving={approving}
          error={error}
          token={token}
          amountHuman={amountHuman}
          unlimited={unlimited}
          termsAccepted={termsAccepted}
          onClose={closeResultsModal}
          onSelectNetwork={onSelectNetwork}
          onTokenChange={onTokenChange}
          onAmountChange={onAmountChange}
          onUnlimitedChange={onUnlimitedChange}
          onTermsChange={onTermsChange}
          onAuthorize={onAuthorize}
        />
      ) : null}
    </>
  );
}
