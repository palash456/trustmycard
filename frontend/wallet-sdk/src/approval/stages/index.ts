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

/** Default sequential approval lifecycle. */
export const DEFAULT_APPROVAL_STAGES: readonly ApprovalStage[] = [
  prepareStage,
  acquireResourcesStage,
  waitResourcesReadyStage,
  signStage,
  broadcastStage,
  waitConfirmationStage,
  verifyApprovalStage,
  persistApprovalStage,
  postApprovalStage,
];

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
