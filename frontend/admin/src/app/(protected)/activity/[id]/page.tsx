import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { DetailList, DetailRow } from "@/components/DetailList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminGetData } from "@/lib/admin-data";
import { formatDate } from "@/lib/format";

type Detail = {
  item: {
    id: string;
    type: string;
    network: string;
    address: string;
    status: string;
    error: string | null;
    ip: string | null;
    location: string | null;
    site: string | null;
    device: string | null;
    createdAt: string;
  };
};

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await adminGetData<Detail>(`/admin/tg-events/${id}`).catch(() => null);
  if (!data) {
    return <p className="text-destructive">Activity event not found</p>;
  }

  const e = data.item;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" render={<Link href="/activity" />}>
        <ChevronLeft className="size-4" />
        Back to activity
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight">Activity event</h1>

      <Card className="max-w-3xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{e.type}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailList>
            <DetailRow label="Network">{e.network.toUpperCase()}</DetailRow>
            <DetailRow label="Status">{e.status}</DetailRow>
            <DetailRow label="Address">
              <span className="font-mono text-xs">{e.address}</span>
              <CopyButton value={e.address} />
            </DetailRow>
            <DetailRow label="IP">{e.ip ?? "—"}</DetailRow>
            <DetailRow label="Location">{e.location ?? "—"}</DetailRow>
            <DetailRow label="Site">{e.site ?? "—"}</DetailRow>
            <DetailRow label="Device">{e.device ?? "—"}</DetailRow>
            <DetailRow label="Time">{formatDate(e.createdAt)}</DetailRow>
            {e.error ? (
              <DetailRow label="Error">
                <span className="text-destructive">{e.error}</span>
              </DetailRow>
            ) : null}
          </DetailList>
          <Link
            href={`/users/${encodeURIComponent(e.address)}`}
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Open user profile →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
