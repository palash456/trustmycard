import { appendAuditRecord } from "./audit.mjs";
import { allocateChangeId } from "./change-id.mjs";
import { createEventEmitter } from "./events.mjs";
import { withUpdateLock } from "./lock.mjs";
import {
  createRollbackSnapshot,
  readRuntimeState,
  writeRuntimeState,
} from "./runtime-state.mjs";
import {
  validateMetaPixelId,
  validateWebsiteDomainInput,
} from "./validators.mjs";
import {
  preflightConfiguration,
  runConfigurationOnlyRelease,
} from "../core/config-only-orchestrator.mjs";
import { verifyDeployment } from "../core/verify.mjs";
import {
  shouldSyncRuntimeConfigToVps,
  syncRuntimeConfigToVps,
} from "./sync-runtime-to-vps.mjs";

export async function runConfigUpdate({
  environment = "production",
  key,
  requestedValue,
  value,
  actor,
  source,
  onEvent,
  deps = {},
}) {
  const effectiveValue = requestedValue ?? value;
  return withUpdateLock(environment, async () => {
    const emit = createEventEmitter(onEvent),
      startedAt = new Date().toISOString(),
      changeId = (deps.allocateChangeId ?? allocateChangeId)(
        () => new Date(),
        environment,
      );
    let prior, candidate, finalValue, ctx;
    const audit = {
      changeId,
      key,
      priorValue: null,
      requestedValue: effectiveValue,
      finalValue: null,
      actor,
      source,
      startedAt,
      completedAt: null,
      phase: "read",
      result: "FAILED",
      events: [],
      error: null,
    };
    const event = (phase, message, extra = {}) => {
      const value = emit(phase, message, { changeId, ...extra });
      audit.events.push(value);
      return value;
    };
    try {
      event("read", "Loading runtime state");
      prior = (deps.readRuntimeState ?? readRuntimeState)(environment);
      audit.priorValue = prior[key];
      event("validation", "Validating requested configuration");
      finalValue =
        key === "WEBSITE_DOMAIN"
          ? (deps.validateWebsiteDomainInput ?? validateWebsiteDomainInput)(
              effectiveValue,
            ).hostname
          : (deps.validateMetaPixelId ?? validateMetaPixelId)(effectiveValue);
      candidate = {
        ...createRollbackSnapshot(prior),
        [key]: finalValue,
        lastChangeId: changeId,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: actor,
        lastSource: source,
      };
      ctx = await deps.createContext(candidate, key);
      ctx.onLog = (message) => event("log", message);
      event("preflight", "Compiling configuration");
      await (deps.preflight ?? preflightConfiguration)(ctx);
      event("apply", "Writing runtime state");
      (deps.writeRuntimeState ?? writeRuntimeState)(environment, candidate);
      event("restart", "Releasing configuration only");
      await (
        deps.release ??
        ((value) =>
          runConfigurationOnlyRelease(value, {
            adapter: deps.adapter,
            onEvent: (item) => onEvent?.({ ...item, changeId }),
          }))
      )(ctx);
      event("verify", "Verifying updated configuration");
      await (
        deps.verify ??
        ((value) =>
          deps.adapter?.verify
            ? deps.adapter.verify(value)
            : verifyDeployment(value))
      )(ctx);
      audit.finalValue = finalValue;
      audit.result = "SUCCESS";
      const provider = ctx.options?.provider ?? ctx.manifest?.provider;
      if (shouldSyncRuntimeConfigToVps(provider, environment)) {
        event("apply", "Syncing runtime state to VPS (config:sync-vps)");
        syncRuntimeConfigToVps(environment, {
          onLog: (message) => event("log", message),
        });
      }
      event("complete", audit.result);
      return { changeId, state: candidate };
    } catch (error) {
      audit.error = error.message;
      if (prior) {
        try {
          event("rollback", "Restoring prior configuration");
          (deps.writeRuntimeState ?? writeRuntimeState)(environment, prior);
          const rollbackCtx = await deps.createContext(prior, key);
          rollbackCtx.onLog = (message) => event("log", message);
          await (
            deps.release ??
            ((value) =>
              runConfigurationOnlyRelease(value, { adapter: deps.adapter }))
          )(rollbackCtx);
          event("verify", "Verifying rolled back configuration");
          await (
            deps.verify ??
            ((value) =>
              deps.adapter?.verify
                ? deps.adapter.verify(value)
                : verifyDeployment(value))
          )(rollbackCtx);
          audit.result = "ROLLED_BACK";
        } catch (rollbackError) {
          audit.result = "FAILED";
          audit.error = `${error.message}; rollback failed: ${rollbackError.message}`;
        }
      }
      event("complete", audit.result, audit.error ? { error: audit.error } : {});
      throw error;
    } finally {
      audit.phase = "complete";
      audit.completedAt = new Date().toISOString();
      appendAuditRecord(environment, audit);
    }
  });
}
