import { cn } from "@/lib/utils";

export function BrandWordmark({
  className,
  size = "md",
  collapsed = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  collapsed?: boolean;
}) {
  const sizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-3xl sm:text-4xl",
  };

  if (collapsed) {
    return (
      <span
        className={cn(
          "font-brand text-base font-bold tracking-tight text-foreground",
          className
        )}
        aria-label="Trust Admin"
      >
        TA
      </span>
    );
  }

  return (
    <span
      className={cn(
        "font-brand inline-flex items-baseline gap-1.5 tracking-tight text-foreground",
        sizes[size],
        className
      )}
    >
      <span className="font-bold">Trust</span>
      <span className="font-medium text-muted-foreground">Admin</span>
    </span>
  );
}
