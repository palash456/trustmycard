import { cn } from "@/lib/utils";

/** Standard vertical rhythm for list and detail pages. */
export function ListPageLayout({
  children,
  className,
  fill,
}: {
  children: React.ReactNode;
  className?: string;
  /** Flex column that fills available height; use with scrollable table cards */
  fill?: boolean;
}) {
  return (
    <div
      className={cn(
        "max-w-full min-w-0",
        fill
          ? "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
          : "space-y-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
