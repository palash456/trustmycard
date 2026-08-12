/** Split comma / slash separated token lists from transaction summaries. */
export function parseTokenSymbols(value: string): string[] {
  return value
    .split(/[,/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function isTokenList(value: string): boolean {
  return parseTokenSymbols(value).length > 1;
}
