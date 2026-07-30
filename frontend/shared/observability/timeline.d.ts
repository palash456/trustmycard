import { type EventContext } from "./event-context";
import type { LogStatus, SessionTimeline, TimelineEvent } from "./schemas";
export declare class SessionTimelineTracker {
    readonly sessionId: string;
    readonly authorizationSessionId?: string;
    private readonly startedAt;
    private completedAt?;
    private outcome?;
    private readonly events;
    private walletAddress?;
    private network?;
    private chain?;
    private rootEventId?;
    constructor(args: {
        sessionId: string;
        authorizationSessionId?: string;
        walletAddress?: string;
        network?: string;
        chain?: string;
    });
    setIdentity(partial: {
        walletAddress?: string;
        network?: string;
        chain?: string;
    }): void;
    startRoot(stage: string, message?: string): TimelineEvent;
    pushFromContext(ctx: EventContext, stage: string, status: LogStatus, partial?: Partial<TimelineEvent>): TimelineEvent;
    push(partial: Omit<TimelineEvent, "ts"> & {
        ts?: string;
    }): TimelineEvent;
    recordError(ctx: EventContext, stage: string, err: unknown, partial?: Partial<TimelineEvent>): TimelineEvent;
    complete(outcome: LogStatus): SessionTimeline;
    snapshot(totalDurationMs?: number): SessionTimeline;
    getRootEventId(): string | undefined;
}
//# sourceMappingURL=timeline.d.ts.map