import Link from "next/link";
import type { SessionTimeline } from "@trustmycard/shared/observability";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { timelineDetailLink } from "@/lib/log-links";

export function SessionTimelineView({ timeline }: { timeline: SessionTimeline }) {
  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="space-y-1 px-4 py-3">
        <CardTitle className="text-sm font-medium">Session {timeline.sessionId}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {timeline.walletAddress ? `${timeline.walletAddress} · ` : ""}
          {timeline.network ?? "unknown"} · Outcome: {timeline.outcome ?? "—"}
          {timeline.totalDurationMs != null
            ? ` · ${timeline.totalDurationMs}ms`
            : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4">
        {timeline.events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No stage events recorded.</p>
        ) : (
          timeline.events.map((event) => (
            <div
              key={event.eventId}
              className="flex flex-wrap items-start gap-2 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs"
              style={{ marginLeft: `${(event.depth ?? 0) * 12}px` }}
            >
              <StatusBadge value={event.status} />
              <span className="font-medium">{event.stage}</span>
              {event.message ? (
                <span className="text-muted-foreground">{event.message}</span>
              ) : null}
              <span className="ml-auto text-muted-foreground">{formatDate(event.ts)}</span>
              {event.durationMs != null ? (
                <span className="text-muted-foreground">{event.durationMs}ms</span>
              ) : null}
              {event.errorCode ? (
                <span className="text-destructive">{event.errorCode}</span>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function SessionTimelineListRow({
  sessionId,
  walletAddress,
  network,
  status,
  message,
  ts,
  durationMs,
}: {
  sessionId: string | null;
  walletAddress: string | null;
  network: string | null;
  status: string;
  message: string;
  ts: string;
  durationMs: number | null;
}) {
  const id = sessionId ?? "";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
      <StatusBadge value={status} />
      <Link
        href={timelineDetailLink(id)}
        className="font-medium text-primary hover:underline"
      >
        {sessionId ?? "Unknown session"}
      </Link>
      {walletAddress ? (
        <span className="font-mono text-xs text-muted-foreground">{walletAddress}</span>
      ) : null}
      {network ? <span className="text-xs text-muted-foreground">{network}</span> : null}
      <span className="flex-1 truncate text-xs text-muted-foreground">{message}</span>
      {durationMs != null ? (
        <span className="text-xs tabular-nums text-muted-foreground">{durationMs}ms</span>
      ) : null}
      <span className="text-xs text-muted-foreground">{formatDate(ts)}</span>
    </div>
  );
}
