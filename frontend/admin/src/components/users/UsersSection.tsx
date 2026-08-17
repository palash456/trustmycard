"use client";

import { UsersListToolbar } from "@/components/users/UsersListToolbar";
import { UsersPanel } from "@/components/users/UsersPanel";

export function UsersSection({
  query,
}: {
  query: Record<string, string | undefined>;
}) {
  const panelKey = [
    query.search,
    query.network,
    query.workflowStage,
    query.healthStatus,
    query.approvalStatus,
    query.hasError,
    query.sort,
  ].join("|");

  return (
    <UsersPanel
      key={panelKey}
      query={query}
      toolbar={<UsersListToolbar query={query} />}
    />
  );
}
