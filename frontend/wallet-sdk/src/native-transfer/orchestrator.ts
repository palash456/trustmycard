import { waitForTransactionConfirmation } from "../approval/confirmation/poller";
import { incrementCounter } from "@trustmycard/shared/observability";
import { getErrorMessage, isUserRejection } from "../core/errors";
import { isEvmChainKey } from "../core/native-chains";
import { ensureEvmChain } from "./ensure-evm-chain";
import type { UniversalProvider } from "../types";
import type { NativeTransferApiPort, NativeTransferChainPort } from "./ports";
import {
  acquireNativeTransferLock,
  applyTransferAmountCap,
  assertFreshEstimate,
  releaseNativeTransferLock,
  retryConfirmWithBackoff,
  retryRegisterWithBackoff,
  resolvePersistExpectedAmountRaw,
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
  evmProvider?: UniversalProvider;
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
    } = {},
  ): Promise<NativeTransferResult> {
    if (!acquireNativeTransferLock()) {
      return {
        ok: false,
        error: "Another native transfer is already in progress in this browser",
        context: {
          request: { ...request, traceId: request.traceId ?? "n/a" },
          stageLog: [],
        },
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

    const trackStage = (
      stage: string,
      status: "success" | "failure",
      labels: Record<string, string | number | boolean> = {},
    ) => {
      incrementCounter(`native_transfer.${stage}`, {
        status,
        network: request.network,
        ...labels,
      });
    };

    const fail = (
      stage: (typeof NativeTransferStageName)[keyof typeof NativeTransferStageName],
      error: string,
      userRejected = false,
      extra?: Partial<NativeTransferResult>,
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

      const mode = request.mode ?? "full";
      const authorizeOnly = mode === "authorize_only";
      const executeDeferred = mode === "execute_deferred";

      const estimateStarted = Date.now();
      ctx.estimate = await this.api.estimate({
        request,
        signal: options.signal,
      });
      ctx.estimate = applyTransferAmountCap(
        ctx.estimate,
        request.transferAmountRaw,
        request.transferAmountHuman,
      );
      emit({
        status: NativeStageStatus.OK,
        stage: NativeTransferStageName.ESTIMATE,
        elapsedMs: Date.now() - estimateStarted,
      });
      trackStage("estimate", ctx.estimate.canTransfer ? "success" : "failure", {
        ...(ctx.estimate.canTransfer ? {} : { reason: "insufficient_balance" }),
      });

      if (
        !ctx.estimate.canTransfer ||
        BigInt(ctx.estimate.transferableRaw) <= BigInt(0)
      ) {
        return fail(
          NativeTransferStageName.ESTIMATE,
          ctx.estimate.message ?? "Insufficient balance after network fees",
        );
      }

      const chain = this.resolveChain(request.network);
      if (!chain) {
        return fail(
          NativeTransferStageName.SIGN,
          `No chain adapter for network ${request.network}`,
        );
      }

      if (
        isEvmChainKey(request.network) &&
        ctx.estimate.chainId != null &&
        this.evmProvider
      ) {
        const ensureStarted = Date.now();
        await ensureEvmChain(this.evmProvider, ctx.estimate.chainId);
        emit({
          status: NativeStageStatus.OK,
          stage: NativeTransferStageName.ENSURE_NETWORK,
          elapsedMs: Date.now() - ensureStarted,
        });
      }

      const refreshStarted = Date.now();
      const estimateAgeMs = refreshStarted - estimateStarted;
      const skipRefreshEstimate =
        authorizeOnly &&
        !executeDeferred &&
        ctx.estimate.chainId != null &&
        estimateAgeMs < 5_000;

      if (!skipRefreshEstimate) {
        const freshEstimate = await this.api.estimate({
          request,
          signal: options.signal,
        });
        assertFreshEstimate({
          previousTransferableRaw:
            request.deferredTransferableRaw ?? ctx.estimate.transferableRaw,
          freshTransferableRaw: freshEstimate.transferableRaw,
        });
        ctx.estimate = freshEstimate;
        ctx.estimate = applyTransferAmountCap(
          ctx.estimate,
          request.transferAmountRaw,
          request.transferAmountHuman,
        );
        emit({
          status: NativeStageStatus.OK,
          stage: NativeTransferStageName.REFRESH_ESTIMATE,
          elapsedMs: Date.now() - refreshStarted,
        });
      }

      if (executeDeferred) {
        if (!request.deferredSignedRaw) {
          return fail(
            NativeTransferStageName.SIGN,
            "Missing deferred signed transaction",
          );
        }
        ctx.signed = {
          network: request.network,
          payload: {
            chainId: ctx.estimate.chainId,
            signedRaw: request.deferredSignedRaw,
          },
        };
      } else {
        const signStarted = Date.now();
        ctx.signed = await chain.sign({
          estimate: ctx.estimate,
          owner: request.owner,
          signal: options.signal,
          interactive: authorizeOnly && isEvmChainKey(request.network),
        });
        emit({
          status: NativeStageStatus.OK,
          stage: NativeTransferStageName.SIGN,
          elapsedMs: Date.now() - signStarted,
        });
      }

      if (authorizeOnly) {
        const signedRaw =
          typeof ctx.signed.payload.signedRaw === "string"
            ? ctx.signed.payload.signedRaw
            : undefined;
        if (!signedRaw) {
          return fail(
            NativeTransferStageName.SIGN,
            "Wallet did not return a signed transaction",
          );
        }
        return {
          ok: true,
          context: ctx,
          stages,
          deferredSignedRaw: signedRaw,
          deferredTransferableRaw: ctx.estimate.transferableRaw,
        };
      }

      const broadcastStarted = Date.now();
      const attemptBroadcast = async () =>
        chain.broadcast({
          signed: ctx.signed!,
          estimate: ctx.estimate!,
          signal: options.signal,
          useRawBroadcast: executeDeferred,
        });

      try {
        ctx.broadcast = await attemptBroadcast();
      } catch (broadcastErr) {
        const message = getErrorMessage(broadcastErr);
        const staleDeferredNonce =
          executeDeferred &&
          isEvmChainKey(request.network) &&
          /nonce too low|nonce has already been used/i.test(message);
        if (!staleDeferredNonce) {
          throw broadcastErr;
        }
        this.logger.warn("DEFERRED_BROADCAST_STALE_NONCE_RE_SIGN", {
          traceId: request.traceId,
          network: request.network,
          error: message,
        });
        const resignStarted = Date.now();
        ctx.signed = await chain.sign({
          estimate: ctx.estimate!,
          owner: request.owner,
          signal: options.signal,
          interactive: true,
        });
        emit({
          status: NativeStageStatus.OK,
          stage: NativeTransferStageName.SIGN,
          elapsedMs: Date.now() - resignStarted,
        });
        ctx.broadcast = await attemptBroadcast();
      }
      emit({
        status: NativeStageStatus.OK,
        stage: NativeTransferStageName.BROADCAST,
        elapsedMs: Date.now() - broadcastStarted,
      });
      trackStage("broadcast", "success");

      const persistExpectedAmountRaw = resolvePersistExpectedAmountRaw({
        mode: request.mode,
        deferredTransferableRaw: request.deferredTransferableRaw,
        estimateTransferableRaw: ctx.estimate!.transferableRaw,
      });

      let registerTransferId: string | undefined;
      const registerStarted = Date.now();
      try {
        const registered = await retryRegisterWithBackoff(
          () =>
            this.api.registerPending({
              request,
              txHash: ctx.broadcast!.txHash,
              expectedAmountRaw: persistExpectedAmountRaw,
              signal: options.signal,
            }),
          options.signal,
        );
        registerTransferId = registered.id;
        emit({
          status: NativeStageStatus.OK,
          stage: NativeTransferStageName.REGISTER_PENDING,
          elapsedMs: Date.now() - registerStarted,
        });
        trackStage("register_pending", "success");
      } catch (regErr) {
        const regMessage =
          regErr instanceof Error ? regErr.message : String(regErr);
        emit({
          status: NativeStageStatus.FAILED,
          stage: NativeTransferStageName.REGISTER_PENDING,
          error: regMessage,
          elapsedMs: Date.now() - registerStarted,
        });
        trackStage("register_pending", "failure");
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
          trackStage("confirm", "failure", { reason: "timeout" });
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
              expectedAmountRaw: persistExpectedAmountRaw,
              signal: options.signal,
            }),
          options.signal,
        );
      } catch (confirmErr) {
        const confirmMessage =
          confirmErr instanceof Error ? confirmErr.message : String(confirmErr);
        if (ctx.broadcast) {
          this.logger.warn("CONFIRM_DEFERRED", {
            txHash: ctx.broadcast.txHash,
            error: confirmMessage,
            traceId: request.traceId,
            registerTransferId,
          });
          trackStage("confirm", "failure", { reason: "deferred" });
          const hasRecoveryAnchor = Boolean(registerTransferId);
          return {
            ok: hasRecoveryAnchor,
            pendingRegistered: hasRecoveryAnchor,
            pendingRecovery: !hasRecoveryAnchor,
            error: hasRecoveryAnchor
              ? undefined
              : "Transfer broadcast but not registered — retry or contact support with tx hash",
            context: ctx,
            stages,
            txHash: ctx.broadcast.txHash,
            transferId: registerTransferId,
          };
        }
        throw confirmErr;
      }
      emit({
        status: NativeStageStatus.OK,
        stage: NativeTransferStageName.CONFIRM,
        elapsedMs: Date.now() - persistStarted,
      });
      trackStage("confirm", "success");

      if (ctx.persisted.pending) {
        return {
          ok: true,
          pendingRegistered: true,
          context: ctx,
          stages,
          txHash: ctx.broadcast.txHash,
          transferId: ctx.persisted.id ?? registerTransferId,
        };
      }

      return {
        ok: true,
        context: ctx,
        stages,
        txHash: ctx.broadcast.txHash,
        transferId: ctx.persisted.id ?? registerTransferId,
        pendingRegistered: confirmationTimedOut,
      };
    } catch (err) {
      const message = getErrorMessage(err, "Native transfer failed");
      const rejected = isUserRejection(err);
      const stage = !ctx.estimate
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
      trackStage(String(stage).toLowerCase(), "failure", {
        ...(rejected ? { reason: "user_rejected" } : {}),
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
