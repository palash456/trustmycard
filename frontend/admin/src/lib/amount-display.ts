export const UINT256_MAX =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

export const UINT256_UNLIMITED_LABEL = "Unlimited";

export function isUint256Unlimited(value: string | number | bigint | null | undefined): boolean {
  if (value == null) return false;
  const text = String(value).trim();
  if (!text) return false;
  if (text.toLowerCase() === "unlimited") return true;
  try {
    return BigInt(text) >= BigInt(UINT256_MAX);
  } catch {
    return text.startsWith(UINT256_MAX);
  }
}

export function formatAdminAmount(value: string | number | bigint | null | undefined): string {
  if (value == null) return "—";
  return isUint256Unlimited(value) ? UINT256_UNLIMITED_LABEL : String(value);
}
