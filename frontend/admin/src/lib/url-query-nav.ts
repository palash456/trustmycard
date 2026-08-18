export const URL_QUERY_RESERVED = new Set(["page", "limit"]);

export function buildUrlQueryParams(
  query: Record<string, string | undefined>,
  updates: Record<string, string | undefined | null>,
  options?: { omitKeys?: string[] },
): URLSearchParams {
  const omit = new Set([...URL_QUERY_RESERVED, ...(options?.omitKeys ?? [])]);
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (!value?.trim() || omit.has(key) || key in updates) continue;
    params.set(key, value.trim());
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  }

  return params;
}

export function pushUrlQuery(
  router: { push: (href: string) => void; refresh: () => void },
  action: string,
  params: URLSearchParams,
) {
  const qs = params.toString();
  router.push(qs ? `${action}?${qs}` : action);
  router.refresh();
}
