export function createEventId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
export function createRootEventContext(partial = {}) {
    const eventId = createEventId();
    return {
        eventId,
        rootEventId: eventId,
        depth: 0,
        ...partial,
    };
}
export function createChildEventContext(parent, partial = {}) {
    return {
        ...parent,
        ...partial,
        eventId: createEventId(),
        parentEventId: parent.eventId,
        rootEventId: parent.rootEventId ?? parent.eventId,
        depth: parent.depth + 1,
    };
}
export function mergeEventContext(base, extra = {}) {
    return { ...base, ...extra };
}
