"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePageRefresh } from "@/components/RefreshProvider";
import { PageSkeleton } from "@/components/skeletons/PageSkeletons";
import { skeletonVariantForPath } from "@/lib/skeleton-variant";

function RefreshProgressBar() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden"
      aria-hidden
    >
      <div className="h-full w-1/3 animate-[shimmer_1.1s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}

export function PageTransitionShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isRefreshing } = usePageRefresh();
  const variant = skeletonVariantForPath(pathname);

  return (
    <div className="relative min-h-0 flex-1">
      {isRefreshing ? <RefreshProgressBar /> : null}

      <div
        className={cn(
          "admin-page-enter relative transition-opacity duration-200",
          isRefreshing && "pointer-events-none opacity-[0.72]",
        )}
      >
        <div key={pathname} className="admin-page-content">
          {children}
        </div>

        {isRefreshing ? (
          <div
            className="absolute inset-0 z-10 animate-in fade-in duration-200"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="absolute inset-0 bg-background/55 backdrop-blur-[1px]" />
            <div className="relative p-1">
              <PageSkeleton variant={variant} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
