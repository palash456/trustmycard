import { PageSkeleton } from "@/components/skeletons/PageSkeletons";

export default function AppLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-4xl">
        <PageSkeleton variant="dashboard" />
      </div>
    </div>
  );
}
