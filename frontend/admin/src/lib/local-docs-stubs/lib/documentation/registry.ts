export const DEFAULT_DOC_SLUG = "overview";

export function getDocPage(_slug: string | undefined) {
  return undefined;
}

export const DOC_PAGES: never[] = [];
export const DOC_NAV_GROUPS: never[] = [];

export function buildTocEntries() {
  return [];
}

export function docHref(slug: string, sectionId?: string) {
  const base = `/documentation/${slug}`;
  return sectionId ? `${base}#${sectionId}` : base;
}
