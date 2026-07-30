const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_RE = /(?:^|[_-])(key|secret|token|password|mnemonic|seed|private|authorization|cookie|apikey|api_key|bearer)(?:$|[_-])/i;
const SENSITIVE_VALUE_HEADERS = new Set([
    "authorization",
    "x-admin-api-key",
    "cookie",
    "set-cookie",
]);
/** Keys that should never appear in log payloads. */
export const REDACTED_FIELDS = [
    "privateKey",
    "mnemonic",
    "seedPhrase",
    "seed",
    "secret",
    "password",
    "accessToken",
    "refreshToken",
    "apiKey",
    "adminApiKey",
    "signedPayload",
    "signedTx",
    "rawTransaction",
];
export function shouldRedactKey(key) {
    if (SENSITIVE_VALUE_HEADERS.has(key.toLowerCase()))
        return true;
    return REDACTED_FIELDS.some((field) => field.toLowerCase() === key.toLowerCase()) || SENSITIVE_KEY_RE.test(key);
}
/** Deep-redact sensitive fields from log context objects. */
export function redactContext(value, depth = 0) {
    if (depth > 8)
        return REDACTED;
    if (value == null)
        return value;
    if (typeof value === "string")
        return value;
    if (Array.isArray(value)) {
        return value.map((item) => redactContext(item, depth + 1));
    }
    if (typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = shouldRedactKey(k) ? REDACTED : redactContext(v, depth + 1);
        }
        return out;
    }
    return value;
}
