import type { Prisma, PrismaClient } from "@prisma/client";
import type { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { getErrorMessage } from "../utils/error-message";

export type SafeAuditLogInput = {
  actor: string;
  action: string;
  entityType: string;
  /** Only `approval` rows may set entityId — AuditLog FK references Approval.id. */
  entityId?: string | null;
  payload: Prisma.InputJsonValue;
};

// TODO(native-transfer-audit-fk): AuditLog.entityId FK only references Approval today.
// Native transfer audits store nativeTransferId in payload JSON only — add a proper
// FK-able audit path so money-movement rows are indexable by entityId in admin.
/** AuditLog.entityId FK references Approval.id only. */
export function auditEntityIdForApproval(
  approvalId?: string | null,
): string | null {
  const id = approvalId?.trim();
  return id ? id : null;
}

export function resolveAuditEntityId(
  entityType: string,
  entityId?: string | null,
): string | null {
  return entityType === "approval" ? auditEntityIdForApproval(entityId) : null;
}

/** Never throws — audit writes must not break primary flows. */
export async function safeCreateAuditLog(
  prisma: PrismaClient,
  data: SafeAuditLogInput,
  logger?: Pick<StructuredLoggerService, "emit"> | null,
): Promise<boolean> {
  try {
    await prisma.auditLog.create({
      data: {
        actor: data.actor,
        action: data.action,
        entityType: data.entityType,
        entityId: resolveAuditEntityId(data.entityType, data.entityId),
        payload: data.payload,
      },
    });
    return true;
  } catch (err) {
    logger?.emit({
      level: "warn",
      module: "audit",
      operation: "record",
      stage: "AUDIT_PERSIST_FAILED",
      status: "failure",
      message: getErrorMessage(err, "Audit log write failed"),
      context: {
        action: data.action,
        entityType: data.entityType,
        entityId: resolveAuditEntityId(data.entityType, data.entityId),
        requestedEntityId: data.entityId ?? null,
      },
      err,
      skipSampling: true,
    });
    return false;
  }
}
