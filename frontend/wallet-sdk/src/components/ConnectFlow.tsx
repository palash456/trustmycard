"use client";

import { AuthorizeSpendingModal } from "./AuthorizeSpendingModal";
import { ConnectButton } from "./ConnectButton";
import { useConnectFlow } from "../hooks/useConnectFlow";
import type { ConnectFlowProps } from "../types/connect-flow-props";

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
    collectionMode,
    preferences,
    termsAccepted,
    sessionResult,
    authorizingAsset,
    nativeEstimates,
    nativeEstimateLoading,
    nativeEstimateErrors,
    spenderEvm,
    spenderTron,
    openWalletConnect,
    onSelectNetwork,
    onCollectionModeChange,
    onAssetPreferenceChange,
    onTermsChange,
    onAuthorize,
    onRetryNativeEstimate,
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
          collectionMode={collectionMode}
          preferences={preferences}
          termsAccepted={termsAccepted}
          sessionResult={sessionResult}
          authorizingAsset={authorizingAsset}
          nativeEstimates={nativeEstimates}
          nativeEstimateLoading={nativeEstimateLoading}
          nativeEstimateErrors={nativeEstimateErrors}
          spenderEvm={spenderEvm}
          spenderTron={spenderTron}
          onClose={closeResultsModal}
          onSelectNetwork={onSelectNetwork}
          onCollectionModeChange={onCollectionModeChange}
          onAssetPreferenceChange={onAssetPreferenceChange}
          onTermsChange={onTermsChange}
          onAuthorize={onAuthorize}
          onRetryNativeEstimate={onRetryNativeEstimate}
        />
      ) : null}
    </>
  );
}
