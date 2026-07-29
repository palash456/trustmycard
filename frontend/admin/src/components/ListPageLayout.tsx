import { cn } from "@/lib/utils";

/** Standard vertical rhythm for list and detail pages. */
export function ListPageLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}
