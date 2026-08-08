import type { PageSkeletonVariant } from "@/components/skeletons/PageSkeletons";

export function skeletonVariantForPath(pathname: string): PageSkeletonVariant {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname.startsWith("/analytics")) return "analytics";
  if (pathname.startsWith("/pipeline/users/")) return "pipeline-user";
  if (
    /\/users\/[^/]+/.test(pathname) ||
    /\/transfers\/[^/]+/.test(pathname) ||
    /\/native-transfers\/[^/]+/.test(pathname) ||
    /\/approvals\/[^/]+/.test(pathname) ||
    /\/wallets\/[^/]+/.test(pathname) ||
    /\/activity\/[^/]+/.test(pathname) ||
    /\/events\/[^/]+/.test(pathname) ||
    pathname.startsWith("/audit/timeline/")
  ) {
    return "detail";
  }
  return "list";
}
