"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { FlaskConical, Moon, RefreshCw, Sun } from "lucide-react";
import { useDemo } from "@/components/DemoProvider";
import { InfoTip } from "@/components/InfoTip";
import { useAdminStream } from "@/hooks/use-admin-stream";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function HeaderControls() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { demo, toggleDemo } = useDemo();
  const { connected } = useAdminStream(!demo);

  return (
    <div className="flex items-center gap-2">
      {connected ? (
        <Badge
          variant="outline"
          className="hidden border-emerald-700/50 text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-400 sm:inline-flex"
        >
          Live
          <InfoTip
            className="ml-0.5"
            text="Connected to the admin SSE stream. Settings and collector events will refresh this page automatically."
          />
        </Badge>
      ) : null}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.refresh()}
        >
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <InfoTip text="Reloads server-rendered data from the backend (or demo fixtures). Use after on-chain activity or when lists look stale." />
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={demo ? "default" : "outline"}
          size="sm"
          onClick={() => {
            toggleDemo();
            router.refresh();
          }}
        >
          <FlaskConical className="size-4" />
          <span className="hidden sm:inline">{demo ? "Demo on" : "Demo"}</span>
        </Button>
        <InfoTip text="When Demo is on, every page shows a month of fictional usage data so you can explore UI states without touching production. Mutations are simulated only. Turn off for live DB data." />
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <InfoTip text="Switch between light and dark themes. Light mode uses high-contrast AAA-oriented colors for text and borders." />
      </div>
    </div>
  );
}
