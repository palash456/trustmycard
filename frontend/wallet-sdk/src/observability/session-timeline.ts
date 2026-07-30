import {
  SessionTimelineTracker,
  type SessionTimeline,
} from "@trustmycard/shared/observability";

export { SessionTimelineTracker, type SessionTimeline };

export async function flushSessionTimeline(
  timeline: SessionTimeline
): Promise<void> {
  try {
    const backend =
      typeof process !== "undefined" && process.env.BACKEND_URL
        ? process.env.BACKEND_URL
        : "";
    const url = backend
      ? `${backend.replace(/\/$/, "")}/v1/client-logs`
      : "/api/client-logs";
    // Fire-and-forget: do not block authorization session completion on persistence.
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "session_timeline", timeline }),
      cache: "no-store",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* soft-fail */
  }
}
