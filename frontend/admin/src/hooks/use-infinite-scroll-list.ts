"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PaginatedFetchResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export function useInfiniteScrollList<T>({
  fetchPage,
}: {
  fetchPage: (
    page: number,
    opts: { knownTotal: number; replace: boolean },
  ) => Promise<PaginatedFetchResult<T>>;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState<"initial" | "more" | null>(
    "initial",
  );
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pagingRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const totalRef = useRef(0);

  const loadPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      const generation = (loadGenerationRef.current += 1);

      if (!replace) {
        if (pagingRef.current) return;
        pagingRef.current = true;
      }

      setLoadingPhase(replace ? "initial" : "more");
      setError(null);
      if (replace) {
        totalRef.current = 0;
      }

      try {
        const data = await fetchPage(nextPage, {
          knownTotal: totalRef.current,
          replace,
        });
        if (generation !== loadGenerationRef.current) return;

        totalRef.current = data.total;
        setTotal(data.total);
        setPage(data.page);
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
        setHasMore(data.page * data.limit < data.total);
      } catch (err) {
        if (generation !== loadGenerationRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load");
        if (replace) {
          setItems([]);
          setHasMore(false);
        }
      } finally {
        if (!replace) pagingRef.current = false;
        if (generation === loadGenerationRef.current) {
          setLoadingPhase(null);
        }
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    void loadPage(1, true);
    return () => {
      loadGenerationRef.current += 1;
      pagingRef.current = false;
    };
  }, [loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loadingPhase) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting) &&
          !pagingRef.current &&
          page >= 1
        ) {
          void loadPage(page + 1, false);
        }
      },
      { root: null, rootMargin: "400px", threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadPage, loadingPhase, page]);

  const loading = loadingPhase !== null;

  return {
    items,
    total,
    loadingPhase,
    loading,
    error,
    hasMore,
    sentinelRef,
  };
}
