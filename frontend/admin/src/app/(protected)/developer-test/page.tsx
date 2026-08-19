import {
  DeveloperTestPanel,
  type DeveloperTestsCatalog,
} from "@/components/DeveloperTestPanel";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ListPageLayout } from "@/components/ListPageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { PageToolbar } from "@/components/PageToolbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { adminGetData } from "@/lib/admin-data";
import { AlertCircle } from "lucide-react";

type LoadResult =
  | { ok: true; catalog: DeveloperTestsCatalog }
  | { ok: false; message: string; disabled: boolean };

async function loadCatalog(): Promise<LoadResult> {
  try {
    const catalog = await adminGetData<DeveloperTestsCatalog>(
      "/admin/developer-tests",
      undefined,
      { bypassDemo: true },
    );
    return { ok: true, catalog };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load developer tests";
    const disabled =
      message.toLowerCase().includes("disabled") || message.includes("403");
    return { ok: false, message, disabled };
  }
}

function DeveloperTestSuccess({ catalog }: { catalog: DeveloperTestsCatalog }) {
  return (
    <ListPageLayout className="space-y-6">
      <PageHeader
        title="Developer Test"
        tip="Run monorepo test suites from the admin panel. Catalog is auto-discovered from spec files — requires ADMIN_DEV_OPS=true and non-production backend."
        description="Discover, run, and inspect all automated tests across backend, wallet-sdk, and shared"
      >
        <PageToolbar>
          <PageRefreshButton />
        </PageToolbar>
      </PageHeader>
      <DeveloperTestPanel catalog={catalog} />
    </ListPageLayout>
  );
}

function DeveloperTestFailure({
  message,
  disabled,
}: {
  message: string;
  disabled: boolean;
}) {
  return (
    <ListPageLayout className="space-y-6">
      <PageHeader
        title="Developer Test"
        tip="Run monorepo test suites from the admin panel. Requires ADMIN_DEV_OPS=true in backend .env (non-production only)."
        description="Discover, run, and inspect all automated tests"
      />
      {disabled ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Developer tests disabled</AlertTitle>
          <AlertDescription>
            Set{" "}
            <code className="rounded bg-muted px-1">ADMIN_DEV_OPS=true</code> in
            the backend environment and ensure{" "}
            <code className="rounded bg-muted px-1">NODE_ENV</code> is not
            production. Restart the backend after changing env.
          </AlertDescription>
        </Alert>
      ) : (
        <ErrorAlert message={message} />
      )}
    </ListPageLayout>
  );
}

export default async function DeveloperTestPage() {
  const result = await loadCatalog();

  if (result.ok) {
    return <DeveloperTestSuccess catalog={result.catalog} />;
  }

  return (
    <DeveloperTestFailure message={result.message} disabled={result.disabled} />
  );
}
