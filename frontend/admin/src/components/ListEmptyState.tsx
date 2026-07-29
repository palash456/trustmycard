import { cn } from "@/lib/utils";

export function ListEmptyState({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p className={cn("py-10 text-center text-sm text-muted-foreground", className)}>
      {message}
    </p>
  );
}
