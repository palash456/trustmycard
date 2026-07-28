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
    asset,
    amountHuman,
    unlimited,
    termsAccepted,
    nativeEstimate,
    nativeEstimateLoading,
    nativeEstimateError,
    onRetryNativeEstimate,
    openWalletConnect,
    onSelectNetwork,
    onAssetChange,
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
          asset={asset}
          amountHuman={amountHuman}
          unlimited={unlimited}
          termsAccepted={termsAccepted}
          nativeEstimate={nativeEstimate}
          nativeEstimateLoading={nativeEstimateLoading}
          nativeEstimateError={nativeEstimateError}
          onRetryNativeEstimate={() => void onRetryNativeEstimate()}
          onClose={closeResultsModal}
          onSelectNetwork={onSelectNetwork}
          onAssetChange={onAssetChange}
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
