import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ListTableCard({
  children,
  className,
  scrollable,
}: {
  children: React.ReactNode;
  className?: string;
  /** Fill remaining space and clip; pair with Table scrollable */
  scrollable?: boolean;
}) {
  return (
    <Card
      className={cn(
        "max-w-full min-w-0 border-0 bg-card",
        scrollable && "flex min-h-0 flex-1 flex-col overflow-hidden py-0",
        className
      )}
    >
      <CardContent
        className={cn("min-w-0 p-0", scrollable && "flex min-h-0 flex-1 flex-col overflow-hidden")}
      >
        {children}
      </CardContent>
    </Card>
  );
}
