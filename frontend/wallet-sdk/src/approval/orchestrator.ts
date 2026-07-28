import type { ApprovalApiPort, ApprovalChainPort } from "./ports";
import { DEFAULT_APPROVAL_STAGES } from "./stages";
import type { ApprovalStage, StageDeps } from "./stages/stage";
import { runChainDiagnosticsSafe } from "./diagnostics/runner";
import {
  ApprovalLifecycleState,
  buildCheckpoint,
  lifecycleAfterStage,
  nextStageAfter,
  restoreContextFromCheckpoint,
  stageIndex,
  type ApprovalCheckpoint,
  type ApprovalLifecycleStore,
} from "./lifecycle";
import { createStructuredApprovalLogger } from "./observability/structured-logger";
import {
  computeBackoffDelay,
  isStageRetryAllowed,
  resolveRetryPolicy,
  sleepMs,
  stageHasArtifact,
} from "./resilience";
import {
  ApprovalStageName,
  StageStatus,
  isStageSuccess,
  type ApprovalContext,
  type ApprovalLogger,
  type ApprovalOrchestrationResult,
  type ApprovalRequest,
  type OrchestratorOptions,
  type StageResult,
} from "./types";

export type ApprovalOrchestratorDeps = {
  api: ApprovalApiPort;
  chains: ApprovalChainPort[];
  stages?: readonly ApprovalStage[];
  logger?: ApprovalLogger;
  lifecycleStore?: ApprovalLifecycleStore;
};

const defaultLogger: ApprovalLogger = {
  info: (event, detail) => {
    if (typeof console !== "undefined") {
      console.info(`[ApprovalOrchestrator] ${event}`, detail ?? {});
    }
  },
  warn: (event, detail) => {
    if (typeof console !== "undefined") {
      console.warn(`[ApprovalOrchestrator] ${event}`, detail ?? {});
    }
  },
  error: (event, detail) => {
    if (typeof console !== "undefined") {
      console.error(`[ApprovalOrchestrator] ${event}`, detail ?? {});
    }
  },
};

/**
 * Chain-agnostic single entry point for every approval flow.
 */
export class ApprovalOrchestrator {
  private readonly api: ApprovalApiPort;
  private readonly chains: ApprovalChainPort[];
  private readonly stages: readonly ApprovalStage[];
  private readonly logger: ApprovalLogger;
  private readonly lifecycleStore?: ApprovalLifecycleStore;

  constructor(deps: ApprovalOrchestratorDeps) {
    this.api = deps.api;
    this.chains = deps.chains;
    this.stages = deps.stages ?? DEFAULT_APPROVAL_STAGES;
    this.logger = deps.logger ?? defaultLogger;
    this.lifecycleStore = deps.lifecycleStore;
  }

  resolveChain(network: string): ApprovalChainPort | null {
    return this.chains.find((c) => c.supports(network)) ?? null;
  }

  async resume(
    checkpoint: ApprovalCheckpoint,
    options: Omit<OrchestratorOptions, "checkpoint"> = {}
  ): Promise<ApprovalOrchestrationResult> {
    return this.run(checkpoint.request, { ...options, checkpoint });
  }

  async run(
    request: ApprovalRequest,
    options: OrchestratorOptions = {}
  ): Promise<ApprovalOrchestrationResult> {
    const store = options.lifecycleStore ?? this.lifecycleStore;
    const clearOnSuccess = options.clearCheckpointOnSuccess ?? true;
    const enableDiagnostics = options.diagnostics ?? true;

    const ctx: ApprovalContext = options.checkpoint
      ? restoreContextFromCheckpoint(options.checkpoint)
      : {
          request: { ...request, traceId: request.traceId ?? "n/a" },
          lifecycleState: ApprovalLifecycleState.IDLE,
          stageLog: [],
        };

    const logger = createStructuredApprovalLogger({
      base: options.logger ?? this.logger,
      getContext: () => ctx,
      forwardToFlowLog: options.forwardLogsToFlowLog ?? false,
    });

    const startStageIndex = options.checkpoint
      ? Math.max(0, stageIndex(options.checkpoint.resumeFromStage, this.stages))
      : 0;

    const overallSignal = combineSignals(options.signal, options.timeoutMs);
    const deps: StageDeps = {
      api: this.api,
      resolveChain: (network) => this.resolveChain(network),
      signal: overallSignal.signal,
      now: Date.now,
      logger,
      confirmation: options.confirmation,
      verifyAllowanceAttempts: options.verifyAllowanceAttempts,
      verifyAllowanceIntervalMs: options.verifyAllowanceIntervalMs,
    };

    const runStarted = Date.now();

    logger.info("APPROVAL_ORCHESTRATION_STARTED", {
      resumeFromStage: options.checkpoint?.resumeFromStage ?? null,
      lifecycleState: options.checkpoint?.lifecycleState ?? ApprovalLifecycleState.IDLE,
    });

    try {
      for (const stage of this.stages.slice(startStageIndex)) {
        ctx.lifecycleState = stageLifecycleEntering(stage.name);
        await persistCheckpoint(store, ctx, stage.name, deps);

        if (stageHasArtifact(stage.name, ctx)) {
          const skipped: StageResult = {
            status: StageStatus.SKIPPED,
            stage: stage.name,
            error: "Skipped — stage artifact already present (idempotent resume)",
            elapsedMs: 0,
            attempt: 0,
          };
          ctx.stageLog.push(skipped);
          options.onStage?.(skipped, ctx);
          ctx.lifecycleState = lifecycleAfterStage(stage.name, true);
          const next = nextStageAfter(stage.name, this.stages);
          if (next) await persistCheckpoint(store, ctx, next, deps);
          continue;
        }

        const result = await this.runStageWithRetries(
          stage,
          ctx,
          deps,
          options,
          logger
        );
        ctx.stageLog.push(result);
        options.onStage?.(result, ctx);
        ctx.lifecycleState = lifecycleAfterStage(stage.name, isStageSuccess(result));

        if (enableDiagnostics && isStageSuccess(result)) {
          await maybeRunDiagnostics(stage.name, ctx, deps, logger);
        }

        if (
          stage.name === ApprovalStageName.POST_APPROVAL &&
          result.status === StageStatus.FAILED
        ) {
          logger.warn("POST_APPROVAL_SOFT_FAIL", { error: result.error });
          continue;
        }

        if (!isStageSuccess(result)) {
          await persistCheckpoint(store, ctx, stage.name, deps, result.error);
          logger.error("APPROVAL_ORCHESTRATION_FAILED", {
            stage: result.stage,
            status: result.status,
            failureKind: result.failureKind ?? null,
            error: result.error,
            userRejected: result.userRejected ?? false,
            attempt: result.attempt ?? null,
          });

          return {
            ok: false,
            status: result.status,
            failedStage: result.stage,
            error: result.error,
            userRejected: result.userRejected,
            context: ctx,
            txHash: ctx.broadcast?.txHash,
            approvalId: ctx.persisted?.approvalId ?? null,
            stages: ctx.stageLog,
          };
        }

        const next = nextStageAfter(stage.name, this.stages);
        if (next) {
          await persistCheckpoint(store, ctx, next, deps);
        } else if (store && clearOnSuccess) {
          store.remove(
            buildCheckpoint({
              ctx,
              lifecycleState: ApprovalLifecycleState.COMPLETED,
              resumeFromStage: ApprovalStageName.POST_APPROVAL,
            }).checkpointId
          );
        }
      }

      ctx.lifecycleState = ApprovalLifecycleState.COMPLETED;
      logger.info("APPROVAL_ORCHESTRATION_SUCCESS", {
        totalElapsedMs: Date.now() - runStarted,
      });

      return {
        ok: true,
        status: StageStatus.OK,
        context: ctx,
        txHash: ctx.broadcast?.txHash,
        approvalId: ctx.persisted?.approvalId ?? null,
        stages: ctx.stageLog,
      };
    } finally {
      overallSignal.dispose();
    }
  }

  private async runStageWithRetries(
    stage: ApprovalStage,
    ctx: ApprovalContext,
    deps: StageDeps,
    options: OrchestratorOptions,
    logger: ApprovalLogger
  ): Promise<StageResult> {
    const legacyMax = options.maxStageRetries;
    const policy = resolveRetryPolicy(stage.name, options.retryPolicies);
    const maxAttempts =
      legacyMax != null ? legacyMax + 1 : policy.maxAttempts;

    let attempt = 0;
    let last: StageResult | null = null;

    while (attempt < maxAttempts) {
      if (deps.signal?.aborted) {
        ctx.lifecycleState = ApprovalLifecycleState.CANCELLED;
        return {
          status: StageStatus.CANCELLED,
          stage: stage.name,
          error: "Cancelled",
          attempt,
        };
      }

      if (stageHasArtifact(stage.name, ctx)) {
        return {
          status: StageStatus.SKIPPED,
          stage: stage.name,
          error: "Artifact present — idempotent no-op",
          attempt,
        };
      }

      const stageStarted = (deps.now ?? Date.now)();
      logger.info("STAGE_START", { stage: stage.name, attempt });

      last = await stage.run(ctx, deps);
      last = {
        ...last,
        attempt,
        elapsedMs: last.elapsedMs ?? (deps.now ?? Date.now)() - stageStarted,
      };

      logger.info("STAGE_END", {
        stage: stage.name,
        status: last.status,
        error: last.error ?? null,
        elapsedMs: last.elapsedMs,
        attempt,
        failureKind: last.failureKind ?? null,
        retryable: last.retryable ?? false,
      });

      if (isStageSuccess(last)) return last;
      if (!isStageRetryAllowed(stage.name, last, ctx) || attempt >= maxAttempts - 1) {
        return last;
      }

      attempt += 1;
      const delayMs = computeBackoffDelay(attempt, policy);
      logger.warn("STAGE_RETRY", {
        stage: stage.name,
        attempt,
        delayMs,
        error: last.error,
        failureKind: last.failureKind ?? null,
      });
      last = { ...last, retryDelayMs: delayMs, status: StageStatus.RETRYING };
      await sleepMs(delayMs, deps.signal);
    }

    return last!;
  }
}

async function maybeRunDiagnostics(
  stage: ApprovalStageName,
  ctx: ApprovalContext,
  deps: StageDeps,
  logger: ApprovalLogger
): Promise<void> {
  const chain = deps.resolveChain(ctx.request.network);
  if (!chain?.runDiagnostics) return;

  const phase =
    stage === ApprovalStageName.SIGN
      ? "post-sign"
      : stage === ApprovalStageName.BROADCAST
        ? "post-broadcast"
        : null;
  if (!phase) return;

  await runChainDiagnosticsSafe(
    chain,
    {
      phase,
      network: ctx.request.network,
      owner: ctx.request.owner,
      prepared: ctx.prepared,
      signed: ctx.signed,
      txHash: ctx.broadcast?.txHash,
      signal: deps.signal,
    },
    logger
  );
}

function stageLifecycleEntering(stage: ApprovalStageName): ApprovalLifecycleState {
  const map: Partial<Record<ApprovalStageName, ApprovalLifecycleState>> = {
    [ApprovalStageName.PREPARE]: ApprovalLifecycleState.PREPARING,
    [ApprovalStageName.ACQUIRE_RESOURCES]: ApprovalLifecycleState.RESOURCES_ACQUIRING,
    [ApprovalStageName.WAIT_RESOURCES_READY]: ApprovalLifecycleState.RESOURCES_ACQUIRING,
    [ApprovalStageName.SIGN]: ApprovalLifecycleState.SIGNING,
    [ApprovalStageName.BROADCAST]: ApprovalLifecycleState.BROADCASTING,
    [ApprovalStageName.WAIT_CONFIRMATION]: ApprovalLifecycleState.CONFIRMING,
    [ApprovalStageName.VERIFY_APPROVAL]: ApprovalLifecycleState.VERIFYING,
    [ApprovalStageName.PERSIST_APPROVAL]: ApprovalLifecycleState.PERSISTING,
    [ApprovalStageName.POST_APPROVAL]: ApprovalLifecycleState.POST_PROCESSING,
  };
  return map[stage] ?? ApprovalLifecycleState.IDLE;
}

async function persistCheckpoint(
  store: ApprovalLifecycleStore | undefined,
  ctx: ApprovalContext,
  resumeFromStage: ApprovalStageName,
  deps: StageDeps,
  lastError?: string
): Promise<void> {
  if (!store) return;
  const checkpoint = buildCheckpoint({
    ctx,
    lifecycleState: ctx.lifecycleState ?? ApprovalLifecycleState.IDLE,
    resumeFromStage,
    lastError,
  });
  await store.save(checkpoint);
  deps.logger?.info("LIFECYCLE_CHECKPOINT", {
    checkpointId: checkpoint.checkpointId,
    resumeFromStage: checkpoint.resumeFromStage,
  });
}

function combineSignals(
  signal?: AbortSignal,
  timeoutMs?: number
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  let timer: ReturnType<typeof setTimeout> | undefined;
  if (typeof timeoutMs === "number" && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  return {
    signal: controller.signal,
    dispose: () => {
      signal?.removeEventListener("abort", onAbort);
      if (timer) clearTimeout(timer);
    },
  };
}
