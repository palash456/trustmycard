/** Keys that should never appear in log payloads. */
export declare const REDACTED_FIELDS: readonly ["privateKey", "mnemonic", "seedPhrase", "seed", "secret", "password", "accessToken", "refreshToken", "apiKey", "adminApiKey", "signedPayload", "signedTx", "rawTransaction"];
export declare function shouldRedactKey(key: string): boolean;
/** Deep-redact sensitive fields from log context objects. */
export declare function redactContext(value: unknown, depth?: number): unknown;
//# sourceMappingURL=redaction.d.ts.map