"use client";

import { usePathname } from "next/navigation";
import { useDemo } from "@/components/DemoProvider";
import { useLogEnv } from "@/components/LogEnvProvider";
import { useBackendStatus } from "@/components/BackendStatusProvider";
import { BackendUnavailablePanel } from "@/components/BackendUnavailablePanel";
import { PageSkeleton } from "@/components/skeletons/PageSkeletons";
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

  if (demo) {
    return children;
  }

  if (isChecking || isSwitching) {
    return <PageSkeleton variant={variant} />;
  }

  if (health && !health.active.ok) {
    return (
      <div className="flex min-h-[50vh] items-start justify-center pt-8">
        <BackendUnavailablePanel
          active={health.active}
          activeEnv={logEnv}
          productionConfigured={productionConfigured}
        />
      </div>
    );
  }

  return children;
}
