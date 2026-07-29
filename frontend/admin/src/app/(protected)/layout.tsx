import { AdminShell } from "@/components/AdminShell";
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
        <DemoBanner />
        {children}
      </AdminShell>
    </DemoProvider>
  );
}
