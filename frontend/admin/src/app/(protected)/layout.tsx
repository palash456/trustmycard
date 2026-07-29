import { AdminShell } from "@/components/AdminShell";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoProvider } from "@/components/DemoProvider";
import { SessionGuard } from "@/components/SessionGuard";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionGuard>
      <DemoProvider>
        <AdminShell>
          <DemoBanner />
          {children}
        </AdminShell>
      </DemoProvider>
    </SessionGuard>
  );
}
