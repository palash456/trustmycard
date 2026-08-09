import {
  createChildEventContext,
  createRootEventContext,
  type EventContext,
} from "@trustmycard/shared/observability";

const stack: EventContext[] = [];

export function pushEventScope(ctx: EventContext): EventContext {
  stack.push(ctx);
  return ctx;
}

export function popEventScope(): EventContext | undefined {
  return stack.pop();
}

export function currentEventScope(): EventContext | undefined {
  return stack[stack.length - 1];
}

export function withEventScope<T>(
  parent: EventContext | undefined,
  fn: (ctx: EventContext) => T,
): T {
  const ctx = parent
    ? createChildEventContext(parent)
    : createRootEventContext();
  pushEventScope(ctx);
  try {
    return fn(ctx);
  } finally {
    popEventScope();
  }
}

export { createRootEventContext, createChildEventContext, type EventContext };
