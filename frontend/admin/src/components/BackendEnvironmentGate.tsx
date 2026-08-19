"use client";

import { usePathname } from "next/navigation";
import { useDemo } from "@/components/DemoProvider";
import { useLogEnv } from "@/components/LogEnvProvider";
import { useBackendStatus } from "@/components/BackendStatusProvider";
import { BackendUnavailablePanel } from "@/components/BackendUnavailablePanel";
import { PageSkeleton } from "@/components/skeletons/PageSkeletons";
import { isMonitoringAdminPath } from "@/lib/local-dev-policy";
import { isAdministrationPath } from "@/lib/developer-mode";
import { skeletonVariantForPath } from "@/lib/skeleton-variant";

export function BackendEnvironmentGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { demo } = useDemo();
  const { logEnv } = useLogEnv();
  const { isChecking, isSwitching, health } = useBackendStatus();
  const variant = skeletonVariantForPath(pathname);
  const productionConfigured = Boolean(health?.production.url);
  const inlineMonitoring = isMonitoringAdminPath(pathname);
  const administration = isAdministrationPath(pathname);
  const envGateExempt = inlineMonitoring || administration;

  if (demo && !administration) {
    return children;
  }

  if ((isChecking || isSwitching) && !envGateExempt) {
    return <PageSkeleton variant={variant} />;
  }

  if (health && !health.active.ok && !envGateExempt) {
    return (
      <div className="flex min-h-[50vh] w-full items-start justify-center px-4 pt-8">
        <div className="w-full max-w-2xl min-w-0">
          <BackendUnavailablePanel
            active={health.active}
            activeEnv={logEnv}
            productionConfigured={productionConfigured}
          />
        </div>
      </div>
    );
  }

  return children;
}
