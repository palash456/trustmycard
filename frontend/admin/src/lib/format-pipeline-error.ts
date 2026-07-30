/** Human-readable pipeline error for admin UI (avoid raw JSON blobs). */
export function formatPipelineErrorMessage(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();

  const gasMatch = text.match(/gas required exceeds allowance/i);
  if (gasMatch) {
    return "Collector wallet has insufficient native gas for transferFrom on this chain.";
  }

  const unpredictable = text.match(/UNPREDICTABLE_GAS_LIMIT|cannot estimate gas/i);
  if (unpredictable) {
    return "Background collection could not estimate gas (collector may need native funds on this chain).";
  }

  if (text.startsWith("{") || text.includes('"reason"')) {
    try {
      const parsed = JSON.parse(text) as { reason?: string; message?: string };
      const inner = parsed.reason ?? parsed.message;
      if (inner) return formatPipelineErrorMessage(inner) ?? inner;
    } catch {
      const reason = text.match(/"reason"\s*:\s*"([^"]+)"/)?.[1];
      if (reason) return formatPipelineErrorMessage(reason) ?? reason;
    }
  }

  if (text.length > 220) {
    return `${text.slice(0, 217)}…`;
  }

  return text;
}
