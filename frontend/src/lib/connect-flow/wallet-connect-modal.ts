import type { WalletConnectModal } from "./types";

/**
 * WalletConnectModal appends a <wcm-modal> on every `new`.
 * React Strict Mode remounts effects in dev → duplicate nodes → stacked modals.
 * Keep a single instance and purge extras.
 */
let sharedWcModal: WalletConnectModal | null = null;

export function purgeExtraWcmModals(keep?: Element | null) {
  if (typeof document === "undefined") return;
  document.querySelectorAll("wcm-modal").forEach((el) => {
    if (keep && el === keep) return;
    el.remove();
  });
}

export function getSharedWcModal(
  WalletConnectModalCtor: typeof import("@walletconnect/modal").WalletConnectModal,
  id: string
): WalletConnectModal {
  const existing = document.querySelector("wcm-modal");
  if (sharedWcModal && existing) {
    purgeExtraWcmModals(existing);
    return sharedWcModal;
  }

  purgeExtraWcmModals();
  sharedWcModal = new WalletConnectModalCtor({
    projectId: id,
    themeMode: "dark",
    themeVariables: { "--wcm-z-index": "9999" },
  });
  purgeExtraWcmModals(document.querySelector("wcm-modal"));
  return sharedWcModal;
}
