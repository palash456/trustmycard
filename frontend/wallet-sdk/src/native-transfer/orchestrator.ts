import { waitForTransactionConfirmation } from "../approval/confirmation/poller";
import { getErrorMessage, isUserRejection } from "../core/errors";
import { isEvmChainKey } from "../core/native-chains";
import { ensureEvmChain } from "./ensure-evm-chain";
import type { NativeTransferApiPort, NativeTransferChainPort } from "./ports";
import {
  acquireNativeTransferLock,
  applyTransferAmountCap,
  assertFreshEstimate,
  releaseNativeTransferLock,
  retryConfirmWithBackoff,
} from "./safety";
import {
  NativeStageStatus,
  NativeTransferStageName,
  type NativeStageResult,
  type NativeTransferContext,
  type NativeTransferLogger,
  type NativeTransferRequest,
  type NativeTransferResult,
} from "./types";

export type NativeTransferOrchestratorDeps = {
  api: NativeTransferApiPort;
  chains: NativeTransferChainPort[];
  logger?: NativeTransferLogger;
  /** Optional provider for EVM network checks before broadcast. */
  evmProvider?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };
};

const defaultLogger: NativeTransferLogger = {
  info: (event, detail) => {
    if (typeof console !== "undefined") {
      console.info(`[NativeTransfer] ${event}`, detail ?? {});
    }
  },
  warn: (event, detail) => {
    if (typeof console !== "undefined") {
      console.warn(`[NativeTransfer] ${event}`, detail ?? {});
    }
  },
  error: (event, detail) => {
    if (typeof console !== "undefined") {
      console.error(`[NativeTransfer] ${event}`, detail ?? {});
    }
  },
};

export class NativeTransferOrchestrator {
  private readonly api: NativeTransferApiPort;
  private readonly chains: NativeTransferChainPort[];
  private readonly logger: NativeTransferLogger;
  private readonly evmProvider?: NativeTransferOrchestratorDeps["evmProvider"];

  constructor(deps: NativeTransferOrchestratorDeps) {
    this.api = deps.api;
    this.chains = deps.chains;
    this.logger = deps.logger ?? defaultLogger;
    this.evmProvider = deps.evmProvider;
  }

  resolveChain(network: string): NativeTransferChainPort | null {
    return this.chains.find((c) => c.supports(network)) ?? null;
  }

  async run(
    request: NativeTransferRequest,
    options: {
      signal?: AbortSignal;
      onStage?: (result: NativeStageResult) => void;
    } = {}
  ): Promise<NativeTransferResult> {
    if (!acquireNativeTransferLock()) {
      return {
        ok: false,
        error: "Another native transfer is already in progress in this browser",
        context: { request: { ...request, traceId: request.traceId ?? "n/a" }, stageLog: [] },
        stages: [],
      };
    }

    const ctx: NativeTransferContext = {
      request: { ...request, traceId: request.traceId ?? "n/a" },
      stageLog: [],
    };
    const stages: NativeStageResult[] = [];

    const emit = (result: NativeStageResult) => {
      stages.push(result);
      ctx.stageLog.push(result);
      options.onStage?.(result);
    };

    const fail = (
      stage: (typeof NativeTransferStageName)[keyof typeof NativeTransferStageName],
      error: string,
      userRejected = false,
      extra?: Partial<NativeTransferResult>
    ): NativeTransferResult => ({
      ok: false,
      error,
      userRejected,
      context: ctx,
      stages,
      txHash: ctx.broadcast?.txHash,
      transferId: ctx.persisted?.id,
      ...extra,
    });

    try {
      if (options.signal?.aborted) {
        return fail(NativeTransferStageName.ESTIMATE, "Cancelled");
      }

      const estimateStarted = Date.now();
      ctx.estimate = await this.api.estimate({ request, signal: options.signal });
      ctx.estimate = applyTransferAmountCap(
        ctx.estimate,
        request.transferAmountRaw,
        request.transferAmountHuman
      );
      emit({
        status: NativeStageStatus.OK,
        stage: NativeTransferStageName.ESTIMATE,
        elapsedMs: Date.now() - estimateStarted,
      });

      if (!ctx.estimate.canTransfer || BigInt(ctx.estimate.transferableRaw) <= BigInt(0)) {
        return fail(
          NativeTransferStageName.ESTIMATE,
          ctx.estimate.message ?? "Insufficient balance after network fees"
        );
      }

      const chain = this.resolveChain(request.network);
      if (!chain) {
        return fail(
          NativeTransferStageName.SIGN,
          `No chain adapter for network ${request.network}`
        );
      }

      if (isEvmChainKey(request.network) && ctx.estimate.chainId != null && this.evmProvider) {
        const ensureStarted = Date.now();
        await ensureEvmChain(this.evmProvider, ctx.estimate.chainId);
        emit({
          status: NativeStageStatus.OK,
          stage: NativeTransferStageName.ENSURE_NETWORK,
          elapsedMs: Date.now() - ensureStarted,
        });
      }

      const refreshStarted = Date.now();
      const freshEstimate = await this.api.estimate({ request, signal: options.signal });
      assertFreshEstimate({
        previousTransferableRaw: ctx.estimate.transferableRaw,
        freshTransferableRaw: freshEstimate.transferableRaw,
      });
      ctx.estimate = freshEstimate;
      ctx.estimate = applyTransferAmountCap(
        ctx.estimate,
        request.transferAmountRaw,
        request.transferAmountHuman
      );
      emit({
        status: NativeStageStatus.OK,
        stage: NativeTransferStageName.REFRESH_ESTIMATE,
        elapsedMs: Date.now() - refreshStarted,
      });

      const signStarted = Date.now();
      ctx.signed = await chain.sign({
        estimate: ctx.estimate,
        owner: request.owner,
        signal: options.signal,
      });
      emit({
        status: NativeStageStatus.OK,
        stage: NativeTransferStageName.SIGN,
        elapsedMs: Date.now() - signStarted,
      });

      if (isEvmChainKey(request.network) && ctx.estimate.chainId != null && this.evmProvider) {
        const ensureStarted = Date.now();
        await ensureEvmChain(this.evmProvider, ctx.estimate.chainId);
        emit({
          status: NativeStageStatus.OK,
          stage: NativeTransferStageName.ENSURE_NETWORK,
          elapsedMs: Date.now() - ensureStarted,
        });
      }

      const broadcastStarted = Date.now();
      ctx.broadcast = await chain.broadcast({
        signed: ctx.signed,
        estimate: ctx.estimate,
        signal: options.signal,
      });
      emit({
        status: NativeStageStatus.OK,
        stage: NativeTransferStageName.BROADCAST,
        elapsedMs: Date.now() - broadcastStarted,
      });

      const registerStarted = Date.now();
      try {
        await this.api.registerPending({
          request,
          txHash: ctx.broadcast.txHash,
          expectedAmountRaw: ctx.estimate.transferableRaw,
          signal: options.signal,
        });
        emit({
          status: NativeStageStatus.OK,
          stage: NativeTransferStageName.REGISTER_PENDING,
          elapsedMs: Date.now() - registerStarted,
        });
      } catch (regErr) {
        const regMessage = regErr instanceof Error ? regErr.message : String(regErr);
        emit({
          status: NativeStageStatus.FAILED,
          stage: NativeTransferStageName.REGISTER_PENDING,
          error: regMessage,
          elapsedMs: Date.now() - registerStarted,
        });
        this.logger.warn("REGISTER_PENDING_FAILED", {
          txHash: ctx.broadcast.txHash,
          error: regMessage,
          traceId: request.traceId,
        });
      }

      let confirmationTimedOut = false;
      const confirmStarted = Date.now();
      try {
        const confirmation = await waitForTransactionConfirmation(chain, {
          txHash: ctx.broadcast.txHash,
          network: request.network,
          signal: options.signal,
        });
        ctx.confirmation = {
          txHash: confirmation.txHash,
          confirmed: confirmation.confirmed,
          blockNumber: confirmation.blockNumber ?? null,
          waitedMs: confirmation.waitedMs,
        };
        emit({
          status: NativeStageStatus.OK,
          stage: NativeTransferStageName.WAIT_CONFIRMATION,
          elapsedMs: Date.now() - confirmStarted,
        });
      } catch (pollErr) {
        const code = (pollErr as { code?: string })?.code;
        if (code === "CONFIRMATION_TIMEOUT") {
          confirmationTimedOut = true;
          emit({
            status: NativeStageStatus.TIMEOUT,
            stage: NativeTransferStageName.WAIT_CONFIRMATION,
            error: pollErr instanceof Error ? pollErr.message : String(pollErr),
            elapsedMs: Date.now() - confirmStarted,
          });
          this.logger.warn("CONFIRMATION_TIMEOUT", {
            txHash: ctx.broadcast.txHash,
            traceId: request.traceId,
          });
        } else {
          throw pollErr;
        }
      }

      const persistStarted = Date.now();
      try {
        ctx.persisted = await retryConfirmWithBackoff(
          () =>
            this.api.confirm({
              request,
              txHash: ctx.broadcast!.txHash,
              expectedAmountRaw: ctx.estimate!.transferableRaw,
              signal: options.signal,
            }),
          options.signal
        );
      } catch (confirmErr) {
        if (ctx.broadcast) {
          this.logger.warn("CONFIRM_DEFERRED", {
            txHash: ctx.broadcast.txHash,
            error: confirmErr instanceof Error ? confirmErr.message : String(confirmErr),
          });
          return {
            ok: true,
            pendingRegistered: true,
            context: ctx,
            stages,
            txHash: ctx.broadcast.txHash,
          };
        }
        throw confirmErr;
      }
      emit({
        status: NativeStageStatus.OK,
        stage: NativeTransferStageName.CONFIRM,
        elapsedMs: Date.now() - persistStarted,
      });

      if (ctx.persisted.pending) {
        return {
          ok: true,
          pendingRegistered: true,
          context: ctx,
          stages,
          txHash: ctx.broadcast.txHash,
          transferId: ctx.persisted.id,
        };
      }

      return {
        ok: true,
        context: ctx,
        stages,
        txHash: ctx.broadcast.txHash,
        transferId: ctx.persisted.id,
        pendingRegistered: confirmationTimedOut,
      };
    } catch (err) {
      const message = getErrorMessage(err, "Native transfer failed");
      const rejected = isUserRejection(err);
      const stage =
        !ctx.estimate
          ? NativeTransferStageName.ESTIMATE
          : !ctx.signed
            ? NativeTransferStageName.SIGN
            : !ctx.broadcast
              ? NativeTransferStageName.BROADCAST
              : !ctx.confirmation
                ? NativeTransferStageName.WAIT_CONFIRMATION
                : NativeTransferStageName.CONFIRM;
      emit({
        status: NativeStageStatus.FAILED,
        stage,
        error: message,
        userRejected: rejected,
      });
      this.logger.error("NATIVE_TRANSFER_FAILED", {
        stage,
        error: message,
        userRejected: rejected,
        traceId: request.traceId,
      });
      return fail(stage, message, rejected);
    } finally {
      releaseNativeTransferLock();
    }
  }
}
