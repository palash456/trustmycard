import { AdminShell } from "@/components/AdminShell";
import { AdminLiveRefresh } from "@/components/AdminLiveRefresh";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoProvider } from "@/components/DemoProvider";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoProvider>
      <AdminShell>
        <AdminLiveRefresh />
        <DemoBanner />
        {children}
      </AdminShell>
    </DemoProvider>
  );
}
