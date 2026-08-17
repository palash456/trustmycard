import { ActivityFeedSection } from "@/components/activity/ActivityFeedSection";
import { ActivityRefreshClient } from "@/components/activity/ActivityRefreshClient";
import {
  ActivityTabsNav,
  type ActivityTab,
} from "@/components/activity/ActivityTabsNav";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";

function parseTab(value: string | undefined): ActivityTab {
  if (
    value === "connections" ||
    value === "flow" ||
    value === "user" ||
    value === "errors" ||
    value === "sessions"
  ) {
    return value;
  }
  return "all";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const activityQuery = { ...sp, tab: tab === "all" ? undefined : tab };

  return (
    <ListPageLayout className="space-y-4">
      <ActivityRefreshClient />
      <PageHeader
        title="Activity"
        description="Real user journeys only — connect, scan, authorize, and pay. Internal and test logs live under Audit."
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>

      <ActivityTabsNav activeTab={tab} query={activityQuery} />

      <ActivityFeedSection query={sp} tab={tab} />
    </ListPageLayout>
  );
}
