"use client";

import {
  AlertCircle,
  BarChart2,
  CheckCircle2,
  FlaskConical,
  Globe,
  Loader2,
  WifiOff,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ProductionPageStatus =
  | "checking"
  | "healthy"
  | "not_connected"
  | "not_configured"
  | "feature_disabled"
  | "demo_mode"
  | "error";

const STATUS_META: Record<
  ProductionPageStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    className: string;
  }
> = {
  checking: {
    label: "Checking connection…",
    icon: Loader2,
    className:
      "border-border bg-muted/60 text-muted-foreground [&_svg]:animate-spin",
  },
  healthy: {
    label: "Active & healthy",
    icon: CheckCircle2,
    className:
      "border-emerald-700/30 bg-emerald-700/15 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-600/15 dark:text-emerald-400",
  },
  not_connected: {
    label: "Not connected",
    icon: WifiOff,
    className:
      "border-amber-800/30 bg-amber-700/15 text-amber-950 dark:border-amber-500/20 dark:bg-amber-600/15 dark:text-amber-400",
  },
  not_configured: {
    label: "Not configured",
    icon: AlertCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  feature_disabled: {
    label: "Feature disabled",
    icon: AlertCircle,
    className:
      "border-amber-800/30 bg-amber-700/15 text-amber-950 dark:border-amber-500/20 dark:bg-amber-600/15 dark:text-amber-400",
  },
  demo_mode: {
    label: "Demo mode",
    icon: FlaskConical,
    className:
      "border-violet-800/30 bg-violet-700/15 text-violet-950 dark:border-violet-500/20 dark:bg-violet-600/15 dark:text-violet-300",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export function ProductionBackendStatusChip({
  status,
  detail,
}: {
  status: ProductionPageStatus;
  detail: string;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className={cn(
          "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 rounded-4xl border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          meta.className,
        )}
      >
        <Icon className="size-3 shrink-0" />
        {meta.label}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm text-left leading-relaxed">
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}

export const FIELD_ICONS = {
  domain: Globe,
  pixel: BarChart2,
} as const;

export function ConfigFieldIcon({
  field,
  className,
}: {
  field: "domain" | "pixel";
  className?: string;
}) {
  const Icon = FIELD_ICONS[field];
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}
