"use client";

import { countByField, ListStatusMiniChart } from "@/components/charts/StatusCharts";

export function ApprovalsListChart({
  items,
}: {
  items: Array<{ status: string; network: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ListStatusMiniChart title="Status breakdown" data={countByField(items, "status")} />
      <ListStatusMiniChart title="Network breakdown" data={countByField(items, "network")} />
    </div>
  );
}

export function TransfersListChart({
  items,
}: {
  items: Array<{ status: string; approval: { network: string } }>;
}) {
  if (items.length === 0) return null;
  const byNetwork: Record<string, number> = {};
  for (const item of items) {
    const key = item.approval.network;
    byNetwork[key] = (byNetwork[key] ?? 0) + 1;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ListStatusMiniChart title="Status breakdown" data={countByField(items, "status")} />
      <ListStatusMiniChart title="Network breakdown" data={byNetwork} />
    </div>
  );
}

export function EventsListChart({
  items,
}: {
  items: Array<{ type: string; status: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ListStatusMiniChart title="Event type breakdown" data={countByField(items, "type")} />
      <ListStatusMiniChart title="Outcome breakdown" data={countByField(items, "status")} />
    </div>
  );
}
