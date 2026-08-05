import type { ApprovalStage } from "./stage";
import { prepareStage } from "./prepare";
import { acquireResourcesStage } from "./acquire-resources";
import { waitResourcesReadyStage } from "./wait-resources";
import { signStage } from "./sign";
import { broadcastStage } from "./broadcast";
import { waitConfirmationStage } from "./wait-confirmation";
import { verifyApprovalStage } from "./verify-approval";
import { persistApprovalStage } from "./persist-approval";
import { postApprovalStage } from "./post-approval";

/** Wallet-only: consecutive popups through on-chain submit (no confirmation polling). */
export const WALLET_PHASE_APPROVAL_STAGES: readonly ApprovalStage[] = [
  prepareStage,
  acquireResourcesStage,
  waitResourcesReadyStage,
  signStage,
  broadcastStage,
];

/** Background: confirm allowance, persist, and queue collection after wallet phase. */
export const SETTLEMENT_APPROVAL_STAGES: readonly ApprovalStage[] = [
  waitConfirmationStage,
  verifyApprovalStage,
  persistApprovalStage,
  postApprovalStage,
];

/** Default sequential approval lifecycle. */
export const DEFAULT_APPROVAL_STAGES: readonly ApprovalStage[] = [
  ...WALLET_PHASE_APPROVAL_STAGES,
  ...SETTLEMENT_APPROVAL_STAGES,
];

export type ApprovalStagePreset = "full" | "wallet" | "settlement";

export function resolveApprovalStages(
  preset: ApprovalStagePreset = "full"
): readonly ApprovalStage[] {
  switch (preset) {
    case "wallet":
      return WALLET_PHASE_APPROVAL_STAGES;
    case "settlement":
      return SETTLEMENT_APPROVAL_STAGES;
    default:
      return DEFAULT_APPROVAL_STAGES;
  }
}

export {
  prepareStage,
  acquireResourcesStage,
  waitResourcesReadyStage,
  signStage,
  broadcastStage,
  waitConfirmationStage,
  verifyApprovalStage,
  persistApprovalStage,
  postApprovalStage,
};
