export type EventContext = {
    eventId: string;
    parentEventId?: string;
    rootEventId?: string;
    depth: number;
    sessionId?: string;
    authorizationSessionId?: string;
    traceId?: string;
    /** Alias for traceId — one opaque ID per user transaction attempt. */
    transactionId?: string;
    correlationId?: string;
    requestId?: string;
    walletAddress?: string;
    chain?: string;
    network?: string;
};
export declare function createEventId(): string;
export declare function createRootEventContext(partial?: Partial<Omit<EventContext, "eventId" | "depth">>): EventContext;
export declare function createChildEventContext(parent: EventContext, partial?: Partial<Omit<EventContext, "eventId" | "parentEventId" | "depth">>): EventContext;
export declare function mergeEventContext(base: Partial<EventContext>, extra?: Partial<EventContext>): Partial<EventContext>;
//# sourceMappingURL=event-context.d.ts.map