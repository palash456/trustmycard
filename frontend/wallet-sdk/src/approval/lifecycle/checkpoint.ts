import type { ApprovalContext } from "../types";
import type { ApprovalCheckpoint, SerializableApprovalContext } from "./types";
import { buildCheckpointId } from "./types";

export function toSerializableContext(
  ctx: ApprovalContext,
): SerializableApprovalContext {
  return {
    prepared: ctx.prepared,
    resources: ctx.resources,
    signed: ctx.signed,
    broadcast: ctx.broadcast,
    confirmation: ctx.confirmation,
    verified: ctx.verified,
    persisted: ctx.persisted,
  };
}

export function applySerializableContext(
  ctx: ApprovalContext,
  snapshot: SerializableApprovalContext,
): void {
  if (snapshot.prepared) ctx.prepared = snapshot.prepared;
  if (snapshot.resources) ctx.resources = snapshot.resources;
  if (snapshot.signed) ctx.signed = snapshot.signed;
  if (snapshot.broadcast) ctx.broadcast = snapshot.broadcast;
  if (snapshot.confirmation) ctx.confirmation = snapshot.confirmation;
  if (snapshot.verified) ctx.verified = snapshot.verified;
  if (snapshot.persisted) ctx.persisted = snapshot.persisted;
}

export function buildCheckpoint(args: {
  ctx: ApprovalContext;
  lifecycleState: ApprovalCheckpoint["lifecycleState"];
  resumeFromStage: ApprovalCheckpoint["resumeFromStage"];
  lastError?: string;
}): ApprovalCheckpoint {
  return {
    checkpointId: buildCheckpointId({
      network: args.ctx.request.network,
      owner: args.ctx.request.owner,
      token: args.ctx.request.token,
      traceId: args.ctx.request.traceId,
    }),
    lifecycleState: args.lifecycleState,
    resumeFromStage: args.resumeFromStage,
    request: { ...args.ctx.request },
    context: toSerializableContext(args.ctx),
    updatedAt: new Date().toISOString(),
    lastError: args.lastError,
  };
}

export function restoreContextFromCheckpoint(
  checkpoint: ApprovalCheckpoint,
): ApprovalContext {
  const ctx: ApprovalContext = {
    request: {
      ...checkpoint.request,
      traceId: checkpoint.request.traceId ?? "n/a",
    },
    stageLog: [],
  };
  applySerializableContext(ctx, checkpoint.context);
  return ctx;
}
