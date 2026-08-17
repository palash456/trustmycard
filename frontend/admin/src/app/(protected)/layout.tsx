import { AdminShell } from "@/components/AdminShell";
import { AdminLiveRefresh } from "@/components/AdminLiveRefresh";
import { BackendEnvironmentGate } from "@/components/BackendEnvironmentGate";
import { BackendStatusProvider } from "@/components/BackendStatusProvider";
import { DemoProvider } from "@/components/DemoProvider";
import { DeveloperModeProvider } from "@/components/DeveloperModeProvider";
import { LocalDevModeDefaults } from "@/components/LocalDevModeDefaults";
import { LogEnvProvider } from "@/components/LogEnvProvider";
import { PageTransitionShell } from "@/components/PageTransitionShell";
import { RefreshProvider } from "@/components/RefreshProvider";
import { InrRatesProvider } from "@/components/InrRatesProvider";
import {
  isProductionBackendConfigured,
  isProductionLogSourceEnabled,
} from "@/lib/admin-backend";

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
        <LocalDevModeDefaults
          productionLogSourceEnabled={isProductionLogSourceEnabled()}
        />
        <RefreshProvider>
          <InrRatesProvider>
            <BackendStatusProvider>
              <DeveloperModeProvider>
                <AdminShell>
                  <AdminLiveRefresh />
                  <BackendEnvironmentGate>
                    <PageTransitionShell>{children}</PageTransitionShell>
                  </BackendEnvironmentGate>
                </AdminShell>
              </DeveloperModeProvider>
            </BackendStatusProvider>
          </InrRatesProvider>
        </RefreshProvider>
      </LogEnvProvider>
    </DemoProvider>
  );
}
