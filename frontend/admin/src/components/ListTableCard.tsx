import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ListTableCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-border/60 shadow-none", className)}>
      <CardContent className="overflow-x-auto p-0">{children}</CardContent>
    </Card>
  );
}
