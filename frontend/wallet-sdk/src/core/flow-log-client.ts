/** Send structured flow events to the server terminal (`npm run dev`). */
export async function postFlowLog(
  step: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  try {
    await fetch("/api/approvals/debug", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ step, ...detail }),
      cache: "no-store",
    });
  } catch {
    /* soft-fail */
  }
}
