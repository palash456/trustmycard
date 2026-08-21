/** Strip null/undefined for compact log payloads. */
export function compactLogDetail(detail) {
    const out = {};
    for (const [k, v] of Object.entries(detail)) {
        if (v !== null && v !== undefined)
            out[k] = v;
    }
    return out;
}
