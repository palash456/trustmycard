import { TransactionsSection } from "@/components/transactions/TransactionsSection";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  return (
    <ListPageLayout className="space-y-4">
      <PageHeader
        title="Transactions"
        description="Every flow-* ID is one user attempt from connect through settlement. Search by ID, wallet, or status."
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>

      <TransactionsSection query={sp} />
    </ListPageLayout>
  );
}
