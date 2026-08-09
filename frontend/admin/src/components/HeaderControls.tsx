"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ChevronDown,
  Cloud,
  FlaskConical,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Settings,
  Sun,
} from "lucide-react";
import { AdminDataModeBadge } from "@/components/AdminDataModeBadge";
import { useBackendStatus } from "@/components/BackendStatusProvider";
import { useAdminDataMode } from "@/components/useAdminDataMode";
import { safeRouterRefresh } from "@/lib/safe-router-refresh";
import {
  ADMIN_DATA_MODES,
  getAdminDataModeMeta,
  type AdminDataMode,
} from "@/lib/admin-data-mode";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DISPLAY_NAME = "Admin";

const MODE_ICONS: Record<AdminDataMode, typeof FlaskConical> = {
  demo: FlaskConical,
  dev: Monitor,
  production: Cloud,
};

export function HeaderControls({ onLogout }: { onLogout: () => void }) {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { mode, meta, productionAvailable } = useAdminDataMode();
  const { switchDataMode } = useBackendStatus();
  const isDark = (resolvedTheme ?? theme) === "dark";

  function refresh() {
    safeRouterRefresh(router);
  }

  const selectableModes = ADMIN_DATA_MODES.filter(
    (item) => item !== "production" || productionAvailable,
  );

  return (
    <div className="flex items-center gap-2">
      <AdminDataModeBadge />

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
          <span className="hidden max-w-[120px] truncate sm:inline">
            {DISPLAY_NAME}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">
                  {DISPLAY_NAME}
                </span>
                <span className="text-xs text-muted-foreground">
                  {meta.description}
                </span>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Data source
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={mode}
              onValueChange={(value) => switchDataMode(value as AdminDataMode)}
            >
              {selectableModes.map((item) => {
                const itemMeta = getAdminDataModeMeta(item);
                const Icon = MODE_ICONS[item];
                return (
                  <DropdownMenuRadioItem
                    key={item}
                    value={item}
                    className="items-start py-2"
                  >
                    <Icon className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium leading-none">
                        {itemMeta.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {itemMeta.description}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={refresh} label="Refresh">
              <RefreshCw />
              Refresh
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setTheme(isDark ? "light" : "dark")}
              label={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? <Sun /> : <Moon />}
              {isDark ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>

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
            <DropdownMenuItem
              variant="destructive"
              onClick={onLogout}
              label="Log out"
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
