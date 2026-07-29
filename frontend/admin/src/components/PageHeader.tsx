import { InfoTip } from "@/components/InfoTip";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  tip,
  children,
  className,
}: {
  title: string;
  description?: string;
  tip?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 pb-6 md:flex-row md:items-start md:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {tip ? <InfoTip text={tip} /> : null}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
