import type { LogEnv } from "@/lib/log-env-cookie";

export type AdminDataMode = "demo" | "dev" | "production";

export type AdminDataModeMeta = {
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  dotClass: string;
};

const MODE_META: Record<AdminDataMode, AdminDataModeMeta> = {
  demo: {
    label: "Demo",
    shortLabel: "Demo",
    description: "Sample fixtures — no live database",
    badgeClass:
      "border-amber-600/30 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
    dotClass: "bg-amber-600 dark:bg-amber-400",
  },
  dev: {
    label: "Development",
    shortLabel: "Dev",
    description: "Local backend at localhost:4000",
    badgeClass:
      "border-violet-600/30 bg-violet-50 text-violet-900 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300",
    dotClass: "bg-violet-600 dark:bg-violet-400",
  },
  production: {
    label: "Production",
    shortLabel: "Prod",
    description: "Live API and production database",
    badgeClass:
      "border-sky-600/30 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300",
    dotClass: "bg-sky-600 dark:bg-sky-400",
  },
};

export function resolveAdminDataMode(options: {
  demo: boolean;
  logEnv: LogEnv;
  liveAdmin?: boolean;
}): AdminDataMode {
  if (options.demo) return "demo";
  if (options.liveAdmin) return "production";
  return options.logEnv === "production" ? "production" : "dev";
}

export function getAdminDataModeMeta(mode: AdminDataMode): AdminDataModeMeta {
  return MODE_META[mode];
}

export const ADMIN_DATA_MODES: AdminDataMode[] = ["demo", "dev", "production"];

export function getSelectableAdminDataModes(options: {
  liveAdmin: boolean;
  productionAvailable: boolean;
}): AdminDataMode[] {
  if (options.liveAdmin) {
    return options.productionAvailable ? ["production", "demo"] : ["demo"];
  }
  return ADMIN_DATA_MODES.filter(
    (mode) => mode !== "production" || options.productionAvailable,
  );
}
