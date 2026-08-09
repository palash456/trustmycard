/** Strip null/undefined for compact log payloads. */
export function compactLogDetail(
  detail: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}
