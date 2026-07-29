"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ChevronDown,
  FlaskConical,
  LogOut,
  Moon,
  RefreshCw,
  Settings,
  Sun,
} from "lucide-react";
import { useDemo } from "@/components/DemoProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const DISPLAY_NAME = "Admin";

export function HeaderControls({ onLogout }: { onLogout: () => void }) {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { demo, setDemo } = useDemo();
  const isDark = (resolvedTheme ?? theme) === "dark";

  function refresh() {
    router.refresh();
  }

  function toggleDemo(checked: boolean) {
    setDemo(checked);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={cn(
          "font-medium",
          demo
            ? "border-amber-700/50 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
            : "border-emerald-700/50 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
        )}
      >
        <span
          className={cn(
            "mr-1.5 size-1.5 rounded-full",
            demo ? "bg-amber-600 dark:bg-amber-400" : "bg-emerald-600 dark:bg-emerald-400"
          )}
          aria-hidden
        />
        {demo ? "Demo" : "Live"}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 px-2.5"
              aria-label="Open account menu"
            />
          }
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {DISPLAY_NAME.charAt(0)}
          </span>
          <span className="hidden max-w-[120px] truncate sm:inline">{DISPLAY_NAME}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{DISPLAY_NAME}</span>
                <span className="text-xs text-muted-foreground">
                  {demo ? "Viewing demo fixtures" : "Connected to live data"}
                </span>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={refresh} label="Refresh">
              <RefreshCw />
              Refresh
            </DropdownMenuItem>

            <DropdownMenuCheckboxItem
              checked={demo}
              onCheckedChange={toggleDemo}
              label="Demo mode"
            >
              <FlaskConical />
              Demo mode
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={isDark}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              label="Dark mode"
            >
              {isDark ? <Moon /> : <Sun />}
              Dark mode
            </DropdownMenuCheckboxItem>

            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              label="App settings"
            >
              <Settings />
              App settings
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={onLogout} label="Log out">
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
