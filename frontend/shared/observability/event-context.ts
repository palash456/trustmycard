export type EventContext = {
  eventId: string;
  parentEventId?: string;
  rootEventId?: string;
  depth: number;
  sessionId?: string;
  authorizationSessionId?: string;
  traceId?: string;
  correlationId?: string;
  requestId?: string;
  walletAddress?: string;
  chain?: string;
  network?: string;
};

export function createEventId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRootEventContext(
  partial: Partial<Omit<EventContext, "eventId" | "depth">> = {},
): EventContext {
  const eventId = createEventId();
  return {
    eventId,
    rootEventId: eventId,
    depth: 0,
    ...partial,
  };
}

export function createChildEventContext(
  parent: EventContext,
  partial: Partial<
    Omit<EventContext, "eventId" | "parentEventId" | "depth">
  > = {},
): EventContext {
  return {
    ...parent,
    ...partial,
    eventId: createEventId(),
    parentEventId: parent.eventId,
    rootEventId: parent.rootEventId ?? parent.eventId,
    depth: parent.depth + 1,
  };
}

export function mergeEventContext(
  base: Partial<EventContext>,
  extra: Partial<EventContext> = {},
): Partial<EventContext> {
  return { ...base, ...extra };
}
