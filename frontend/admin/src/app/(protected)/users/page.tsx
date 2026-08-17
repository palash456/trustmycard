import Link from "next/link";
import { Receipt } from "lucide-react";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { UsersSection } from "@/components/users/UsersSection";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  return (
    <ListPageLayout
      fill
      className="h-[calc(100dvh-18rem)] max-h-[calc(100dvh-18rem)]"
    >
      <PageHeader
        className="shrink-0"
        title="Users"
        description="Wallet addresses grouped by activity — open a user or browse their transaction journeys"
        tip="Each wallet is a user profile. Use Transactions to search by flow-* journey ID across all wallets."
      >
        <PageToolbar>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-primary hover:bg-muted"
          >
            <Receipt className="size-3.5" />
            All transactions
          </Link>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>

      <UsersSection query={sp} />
    </ListPageLayout>
  );
}
