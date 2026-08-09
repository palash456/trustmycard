import { cn } from "@/lib/utils";

/** Right-aligned header actions (filters, refresh, export). */
export function PageToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
