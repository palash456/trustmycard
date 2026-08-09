import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/observability";

export function formatActivityError(
  error: unknown,
  status?: string,
): string | null {
  if (error == null || error === "") {
    return status === "error" ? "Unknown error" : null;
  }
  const message = getErrorMessage(error, "");
  if (message && message !== "[object Object]") return message;
  return status === "error" ? "Unknown error" : null;
}

export function ActivityErrorCell({
  error,
  status,
}: {
  error: unknown;
  status: string;
}) {
  const message = formatActivityError(error, status);
  const isError = status === "error" || Boolean(message);

  if (!message) {
    if (isError) {
      return (
        <Badge
          variant="destructive"
          className="text-[10px] font-semibold uppercase"
        >
          Failed
        </Badge>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const short = message.length > 96 ? `${message.slice(0, 93)}…` : message;

  return (
    <div className="flex max-w-[260px] flex-col gap-1.5">
      <Badge
        variant="destructive"
        className="w-fit text-[10px] font-semibold uppercase"
      >
        Error
      </Badge>
      <p className="text-xs leading-snug text-destructive" title={message}>
        {short}
      </p>
    </div>
  );
}
