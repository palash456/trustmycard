/** Platform click identifiers only — never UTM or other client-supplied marketing params. */
export const CLICK_ID_PARAMS = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "ttclid",
  "li_fat_id",
] as const;

export type ClickIdParam = (typeof CLICK_ID_PARAMS)[number];

export function hasClickIdentifier(searchParams: URLSearchParams): boolean {
  return CLICK_ID_PARAMS.some((param) => searchParams.has(param));
}

export function copyClickIdentifiers(
  from: URLSearchParams,
  to: URLSearchParams,
): void {
  for (const param of CLICK_ID_PARAMS) {
    const value = from.get(param);
    if (value) to.set(param, value);
  }
}
