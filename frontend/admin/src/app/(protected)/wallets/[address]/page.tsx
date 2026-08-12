import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { WalletAddressText } from "@/components/WalletAddressLink";
import { ErrorAlert } from "@/components/ErrorAlert";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { activityLink } from "@/lib/log-links";
import { adminGetData } from "@/lib/admin-data";
import { formatAdminAmount } from "@/lib/amount-display";
import { formatDate } from "@/lib/format";

type WalletDetail = {
  address: string;
  approvals: Array<{
    id: string;
    network: string;
    tokenSymbol: string;
    status: string;
    createdAt: string;
  }>;
  nativeTransfers: Array<{
    id: string;
    network: string;
    assetSymbol: string;
    status: string;
    amountHuman: string;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    type: string;
    network: string;
    status: string;
    createdAt: string;
  }>;
  transfers: Array<{
    id: string;
    amountRaw: string;
    status: string;
    createdAt: string;
    approval: { network: string; tokenSymbol: string };
  }>;
  timeline?: Array<{
    type: string;
    id: string;
    at: string;
    label: string;
    status: string;
  }>;
};

export default async function WalletDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const decoded = decodeURIComponent(address);
  let data: WalletDetail | null = null;
  let error: string | null = null;
  try {
    data = await adminGetData<WalletDetail>(
      `/admin/wallets/${encodeURIComponent(decoded)}`,
    );
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load wallet";
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          render={<Link href="/wallets" />}
        >
          <ChevronLeft className="size-4" />
          Back to wallets
        </Button>
        <ErrorAlert message={error} />
      </div>
    );
  }

  if (!data) {
    return <p className="text-destructive">Wallet not found</p>;
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        render={<Link href="/wallets" />}
      >
        <ChevronLeft className="size-4" />
        Back to wallets
      </Button>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          <WalletAddressText
            address={data.address}
            className="text-lg font-semibold"
          />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wallet activity overview
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/transactions?walletAddress=${encodeURIComponent(data.address)}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Transaction journeys
        </Link>
        <Link
          href={activityLink({ address: data.address })}
          className="text-sm text-primary hover:underline"
        >
          Activity feed
        </Link>
        <Link
          href={`/users/${encodeURIComponent(data.address)}`}
          className="text-sm text-primary hover:underline"
        >
          User profile
        </Link>
      </div>

      <Tabs defaultValue="timeline">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="timeline">
            Timeline ({data.timeline?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals ({data.approvals.length})
          </TabsTrigger>
          <TabsTrigger value="transfers">
            Transfers ({data.transfers.length})
          </TabsTrigger>
          <TabsTrigger value="native">
            Native ({data.nativeTransfers.length})
          </TabsTrigger>
          <TabsTrigger value="events">
            Events ({data.events.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {(data.timeline ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No activity</p>
              ) : (
                (data.timeline ?? []).map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="px-4 py-3 text-sm"
                  >
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.at)}
                    </p>
                    <p className="font-medium">{item.label}</p>
                    <StatusBadge value={item.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {data.approvals.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No approvals
                </p>
              ) : (
                data.approvals.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    <Link
                      href={`/approvals/${a.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {a.network} {a.tokenSymbol}
                    </Link>
                    <StatusBadge value={a.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(a.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {data.transfers.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No transfers
                </p>
              ) : (
                data.transfers.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    <Link
                      href={`/transfers/${t.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {t.approval.network} {t.approval.tokenSymbol} ·{" "}
                      {formatAdminAmount(t.amountRaw)}
                    </Link>
                    <StatusBadge value={t.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="native" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {data.nativeTransfers.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No native transfers
                </p>
              ) : (
                data.nativeTransfers.map((n) => (
                  <div
                    key={n.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    <Link
                      href={`/native-transfers/${n.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {n.network} {n.assetSymbol} · {n.amountHuman}
                    </Link>
                    <StatusBadge value={n.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Flow events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events</p>
              ) : (
                data.events.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
                  >
                    {formatDate(e.createdAt)} · {e.type} · {e.network} ·{" "}
                    {e.status}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
