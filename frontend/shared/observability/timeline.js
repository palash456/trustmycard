import { createEventId } from "./event-context";
import { serializeError, getErrorCode } from "./errors";
export class SessionTimelineTracker {
    constructor(args) {
        this.events = [];
        this.sessionId = args.sessionId;
        this.authorizationSessionId = args.authorizationSessionId ?? args.sessionId;
        this.walletAddress = args.walletAddress;
        this.network = args.network;
        this.chain = args.chain;
        this.startedAt = new Date().toISOString();
    }
    setIdentity(partial) {
        if (partial.walletAddress)
            this.walletAddress = partial.walletAddress;
        if (partial.network)
            this.network = partial.network;
        if (partial.chain)
            this.chain = partial.chain;
    }
    startRoot(stage, message) {
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
    pushFromContext(ctx, stage, status, partial = {}) {
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
    push(partial) {
        const event = {
            ts: partial.ts ?? new Date().toISOString(),
            ...partial,
        };
        if (event.error && !event.errorCode) {
            event.errorCode = getErrorCode(event.error) ?? undefined;
        }
        this.events.push(event);
        return event;
    }
    recordError(ctx, stage, err, partial = {}) {
        return this.pushFromContext(ctx, stage, "failure", {
            ...partial,
            error: serializeError(err),
            errorCode: getErrorCode(err) ?? undefined,
            message: partial.message,
        });
    }
    complete(outcome) {
        this.completedAt = new Date().toISOString();
        this.outcome = outcome;
        const totalDurationMs = Date.parse(this.completedAt) - Date.parse(this.startedAt);
        return this.snapshot(totalDurationMs);
    }
    snapshot(totalDurationMs) {
        const end = this.completedAt ?? new Date().toISOString();
        const duration = totalDurationMs ??
            Date.parse(end) - Date.parse(this.startedAt);
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
    getRootEventId() {
        return this.rootEventId;
    }
}
