import { createEventId, type EventContext } from "./event-context";
import { serializeError, getErrorCode } from "./errors";
import type { LogStatus, SessionTimeline, TimelineEvent } from "./schemas";

export class SessionTimelineTracker {
  readonly sessionId: string;
  readonly authorizationSessionId?: string;
  private readonly startedAt: string;
  private completedAt?: string;
  private outcome?: LogStatus;
  private readonly events: TimelineEvent[] = [];
  private walletAddress?: string;
  private network?: string;
  private chain?: string;
  private rootEventId?: string;

  constructor(args: {
    sessionId: string;
    authorizationSessionId?: string;
    walletAddress?: string;
    network?: string;
    chain?: string;
  }) {
    this.sessionId = args.sessionId;
    this.authorizationSessionId = args.authorizationSessionId ?? args.sessionId;
    this.walletAddress = args.walletAddress;
    this.network = args.network;
    this.chain = args.chain;
    this.startedAt = new Date().toISOString();
  }

  setIdentity(partial: {
    walletAddress?: string;
    network?: string;
    chain?: string;
  }): void {
    if (partial.walletAddress) this.walletAddress = partial.walletAddress;
    if (partial.network) this.network = partial.network;
    if (partial.chain) this.chain = partial.chain;
  }

  startRoot(stage: string, message?: string): TimelineEvent {
    const eventId = createEventId();
    this.rootEventId = eventId;
    return this.push({
      eventId,
      parentEventId: null,
      rootEventId: eventId,
      depth: 0,
      stage,
      status: "started",
      message,
    });
  }

  pushFromContext(
    ctx: EventContext,
    stage: string,
    status: LogStatus,
    partial: Partial<TimelineEvent> = {},
  ): TimelineEvent {
    return this.push({
      eventId: ctx.eventId,
      parentEventId: ctx.parentEventId ?? null,
      rootEventId: ctx.rootEventId,
      depth: ctx.depth,
      stage,
      status,
      ...partial,
    });
  }

  push(partial: Omit<TimelineEvent, "ts"> & { ts?: string }): TimelineEvent {
    const event: TimelineEvent = {
      ts: partial.ts ?? new Date().toISOString(),
      ...partial,
    };
    if (event.error && !event.errorCode) {
      event.errorCode = getErrorCode(event.error) ?? undefined;
    }
    this.events.push(event);
    return event;
  }

  recordError(
    ctx: EventContext,
    stage: string,
    err: unknown,
    partial: Partial<TimelineEvent> = {},
  ): TimelineEvent {
    return this.pushFromContext(ctx, stage, "failure", {
      ...partial,
      error: serializeError(err),
      errorCode: getErrorCode(err) ?? undefined,
      message: partial.message,
    });
  }

  complete(outcome: LogStatus): SessionTimeline {
    this.completedAt = new Date().toISOString();
    this.outcome = outcome;
    const totalDurationMs =
      Date.parse(this.completedAt) - Date.parse(this.startedAt);
    return this.snapshot(totalDurationMs);
  }

  snapshot(totalDurationMs?: number): SessionTimeline {
    const end = this.completedAt ?? new Date().toISOString();
    const duration =
      totalDurationMs ?? Date.parse(end) - Date.parse(this.startedAt);
    return {
      sessionId: this.sessionId,
      authorizationSessionId: this.authorizationSessionId,
      walletAddress: this.walletAddress,
      network: this.network,
      chain: this.chain,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      outcome: this.outcome,
      totalDurationMs: duration,
      events: [...this.events],
    };
  }

  getRootEventId(): string | undefined {
    return this.rootEventId;
  }
}
