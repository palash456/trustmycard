import { EVENT_PHASES } from "./constants.mjs";
export function createEventEmitter(onEvent) {
  return (phase, message, extra = {}) => {
    if (!EVENT_PHASES.includes(phase))
      throw new Error(`Unknown config event phase: ${phase}`);
    const event = { phase, message, at: new Date().toISOString(), ...extra };
    onEvent?.(event);
    return event;
  };
}
