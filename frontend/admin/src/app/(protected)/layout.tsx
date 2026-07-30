import { AdminShell } from "@/components/AdminShell";
import { AdminLiveRefresh } from "@/components/AdminLiveRefresh";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoProvider } from "@/components/DemoProvider";
import { PageTransitionShell } from "@/components/PageTransitionShell";
import { RefreshProvider } from "@/components/RefreshProvider";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoProvider>
      <RefreshProvider>
        <AdminShell>
          <AdminLiveRefresh />
          <DemoBanner />
          <PageTransitionShell>{children}</PageTransitionShell>
        </AdminShell>
      </RefreshProvider>
    </DemoProvider>
  );
}
