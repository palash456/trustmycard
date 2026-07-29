/**
 * Development/testing flag: allow owner wallet to equal spender/collector.
 *
 * ALLOW_SELF_SPENDER=false (default) — production behavior: block self-spender /
 * self-recipient flows that the product already rejects.
 * ALLOW_SELF_SPENDER=true — local testing with a single wallet; do not reject
 * solely because owner === spender/recipient when the chain would accept it.
 */
export function isAllowSelfSpender(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = (env.ALLOW_SELF_SPENDER ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Case-insensitive address equality (EVM hex or Tron base58 treated as strings). */
export function addressesEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * True when the product should reject this owner/spender-or-recipient pair.
 * Returns false when addresses differ, or when ALLOW_SELF_SPENDER is enabled.
 */
export function shouldBlockSelfSpender(
  owner: string,
  spenderOrRecipient: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  if (!owner.trim() || !spenderOrRecipient.trim()) return false;
  if (!addressesEqual(owner, spenderOrRecipient)) return false;
  return !isAllowSelfSpender(env);
}
