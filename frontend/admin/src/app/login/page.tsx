import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { BrandWordmark } from "@/components/BrandWordmark";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="login-hero relative hidden flex-col justify-between border-r border-border/60 px-10 py-10 lg:flex">
        <BrandWordmark size="md" />
        <div className="max-w-sm space-y-4">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            Trust Admin
          </p>
          <h1 className="font-brand text-4xl font-semibold tracking-tight text-foreground">
            Operations console
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Monitor approvals, transfers, collectors, and platform settings from a
            single secure panel.
          </p>
        </div>
        <p className="text-xs text-muted-foreground/80">Trusted access only</p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="space-y-3 lg:hidden">
            <BrandWordmark size="md" />
          </div>
          <div className="surface-elevated space-y-6 p-6 sm:p-8">
            <div className="space-y-1">
              <h2 className="font-brand text-xl font-semibold tracking-tight text-foreground">
                Sign in
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter the panel password to continue.
              </p>
            </div>
            <Suspense
              fallback={
                <div className="space-y-4">
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
