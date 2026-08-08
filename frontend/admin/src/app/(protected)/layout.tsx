import { AdminShell } from "@/components/AdminShell";
import { AdminLiveRefresh } from "@/components/AdminLiveRefresh";
import { BackendEnvironmentGate } from "@/components/BackendEnvironmentGate";
import { BackendStatusProvider } from "@/components/BackendStatusProvider";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoProvider } from "@/components/DemoProvider";
import { LogEnvBanner } from "@/components/LogEnvBanner";
import { LogEnvProvider } from "@/components/LogEnvProvider";
import { PageTransitionShell } from "@/components/PageTransitionShell";
import { RefreshProvider } from "@/components/RefreshProvider";
import { isProductionBackendConfigured } from "@/lib/admin-backend";

export const dynamic = "force-dynamic";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const logEnvToggleEnabled = isProductionBackendConfigured();

  return (
    <DemoProvider>
      <LogEnvProvider toggleEnabled={logEnvToggleEnabled}>
        <RefreshProvider>
          <BackendStatusProvider>
            <AdminShell>
              <AdminLiveRefresh />
              <DemoBanner />
              <LogEnvBanner />
              <BackendEnvironmentGate>
                <PageTransitionShell>{children}</PageTransitionShell>
              </BackendEnvironmentGate>
            </AdminShell>
          </BackendStatusProvider>
        </RefreshProvider>
      </LogEnvProvider>
    </DemoProvider>
  );
}
