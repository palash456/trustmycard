/**
 * Development/testing flag: allow owner wallet to equal spender/collector.
 *
 * ALLOW_SELF_SPENDER=false (default) — production behavior: block self-spender /
 * self-recipient flows that the product already rejects.
 * ALLOW_SELF_SPENDER=true — local testing with a single wallet; do not reject
 * solely because owner === spender/recipient when the chain would accept it.
 */
export declare function isAllowSelfSpender(env?: NodeJS.ProcessEnv | Record<string, string | undefined>): boolean;
/** Case-insensitive address equality (EVM hex or Tron base58 treated as strings). */
export declare function addressesEqual(a: string, b: string): boolean;
/**
 * True when the product should reject this owner/spender-or-recipient pair.
 * Returns false when addresses differ, or when ALLOW_SELF_SPENDER is enabled.
 */
export declare function shouldBlockSelfSpender(owner: string, spenderOrRecipient: string, env?: NodeJS.ProcessEnv | Record<string, string | undefined>): boolean;
//# sourceMappingURL=self-spender.d.ts.map