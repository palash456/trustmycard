import type { DocNavGroup, DocPage, DocSearchResult } from "./types";

export function searchDocumentation(
  query: string,
  pages: DocPage[],
  navGroups: DocNavGroup[]
): DocSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const results: DocSearchResult[] = [];
  const seen = new Set<string>();

  const groupBySlug = new Map<string, string>();
  for (const group of navGroups) {
    for (const item of group.items) {
      groupBySlug.set(item.slug, group.title);
    }
  }

  for (const page of pages) {
    const group = groupBySlug.get(page.slug) ?? "Documentation";
    const titleKey = `${page.slug}:title`;
    if (page.title.toLowerCase().includes(normalized) && !seen.has(titleKey)) {
      seen.add(titleKey);
      results.push({ slug: page.slug, title: page.title, group, match: "title" });
    }

    for (const keyword of page.keywords ?? []) {
      const keywordKey = `${page.slug}:kw:${keyword}`;
      if (keyword.toLowerCase().includes(normalized) && !seen.has(keywordKey)) {
        seen.add(keywordKey);
        results.push({ slug: page.slug, title: page.title, group, match: "keyword" });
      }
    }

    for (const section of page.sections) {
      const sectionKey = `${page.slug}:section:${section.id}`;
      if (
        (section.title.toLowerCase().includes(normalized) ||
          section.id.toLowerCase().includes(normalized)) &&
        !seen.has(sectionKey)
      ) {
        seen.add(sectionKey);
        results.push({
          slug: page.slug,
          title: page.title,
          group,
          match: "section",
          sectionTitle: section.title,
          sectionId: section.id,
        });
      }

      for (const subsection of section.subsections ?? []) {
        const subKey = `${page.slug}:sub:${subsection.id}`;
        if (
          (subsection.title.toLowerCase().includes(normalized) ||
            subsection.id.toLowerCase().includes(normalized)) &&
          !seen.has(subKey)
        ) {
          seen.add(subKey);
          results.push({
            slug: page.slug,
            title: page.title,
            group,
            match: "section",
            sectionTitle: subsection.title,
            sectionId: subsection.id,
          });
        }
      }
    }
  }

  return results.slice(0, 20);
}
