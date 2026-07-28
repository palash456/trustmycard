"use client";

import { AuthorizeSpendingModal } from "./AuthorizeSpendingModal";
import { ConnectButton } from "./ConnectButton";
import { useConnectFlow } from "../hooks/useConnectFlow";
import type { ConnectFlowProps } from "../types/connect-flow-props";
import { getSpenderForNetwork } from "../types/connect-flow-props";

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
  } = useConnectFlow(props);

  const spenderAddress = selectedKey
    ? getSpenderForNetwork(props, selectedKey)
    : "";

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
          spenderAddress={spenderAddress}
        />
      ) : null}
    </>
  );
}
