import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Info, Lightbulb, TriangleAlert } from "lucide-react";

export function DocLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const isInternal = href.startsWith("/documentation/");
  if (isInternal) {
    return (
      <Link
        href={href}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className="font-medium text-primary underline-offset-4 hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

export function DocP({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-sm leading-7 text-foreground/90", className)}>
      {children}
    </p>
  );
}

export function DocUl({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-7 text-foreground/90">
      {children}
    </ul>
  );
}

export function DocOl({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-7 text-foreground/90">
      {children}
    </ol>
  );
}

export function DocLi({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}

export function DocCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground">
      {children}
    </code>
  );
}

export function DocPre({
  children,
  title,
}: {
  children: string;
  title?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/40">
      {title ? (
        <div className="border-b border-border/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
      ) : null}
      <pre className="overflow-x-auto p-3 font-mono text-[0.8125rem] leading-6 text-foreground/95">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-border/70 bg-muted/50">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="px-3 py-2 font-medium text-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/50 last:border-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-3 py-2 align-top text-foreground/90"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type CalloutVariant = "info" | "tip" | "warning";

const CALLOUT_META: Record<
  CalloutVariant,
  { icon: typeof Info; title: string; className: string }
> = {
  info: {
    icon: Info,
    title: "Note",
    className: "border-primary/30 bg-primary/5",
  },
  tip: {
    icon: Lightbulb,
    title: "Tip",
    className:
      "border-emerald-600/30 bg-emerald-500/5 dark:border-emerald-500/30",
  },
  warning: {
    icon: TriangleAlert,
    title: "Important",
    className: "border-amber-600/30 bg-amber-500/5 dark:border-amber-500/30",
  },
};

export function DocCallout({
  variant = "info",
  title,
  children,
}: {
  variant?: CalloutVariant;
  title?: string;
  children: React.ReactNode;
}) {
  const meta = CALLOUT_META[variant];
  const Icon = meta.icon;
  return (
    <Alert className={cn("py-3", meta.className)}>
      <Icon className="size-4" />
      <AlertTitle>{title ?? meta.title}</AlertTitle>
      <AlertDescription className="text-sm leading-6 text-foreground/90">
        {children}
      </AlertDescription>
    </Alert>
  );
}

export function DocFlow({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3 text-sm leading-6">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span className="pt-0.5 text-foreground/90">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export function DocLayerStack({
  layers,
}: {
  layers: { title: string; items: string[]; note?: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      {layers.map((layer, index) => (
        <div
          key={layer.title}
          className={cn(
            "bg-card px-4 py-3",
            index < layers.length - 1 && "border-b border-border/60",
          )}
        >
          <p className="mb-2 text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
            {layer.title}
          </p>
          <div className="flex flex-wrap gap-2">
            {layer.items.map((item) => (
              <span
                key={item}
                className="rounded-md border border-border/60 bg-muted/50 px-2.5 py-1 font-mono text-xs text-foreground/90"
              >
                {item}
              </span>
            ))}
          </div>
          {layer.note ? (
            <p className="mt-2 text-xs text-muted-foreground">{layer.note}</p>
          ) : null}
          {index < layers.length - 1 ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">↓</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DocFlowChart({
  nodes,
  direction = "horizontal",
}: {
  nodes: string[];
  direction?: "horizontal" | "vertical";
}) {
  if (direction === "vertical") {
    return (
      <div className="flex flex-col items-center gap-1">
        {nodes.map((node, index) => (
          <div
            key={`${node}-${index}`}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-full max-w-md rounded-lg border border-border/70 bg-muted/30 px-4 py-2.5 text-center text-sm text-foreground/90">
              {node}
            </div>
            {index < nodes.length - 1 ? (
              <span className="text-muted-foreground">↓</span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nodes.map((node, index) => (
        <div key={`${node}-${index}`} className="flex items-center gap-2">
          <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-foreground/90">
            {node}
          </div>
          {index < nodes.length - 1 ? (
            <span className="text-muted-foreground">→</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export type DocTestCaseRow = {
  step: string;
  action: React.ReactNode;
  expected: React.ReactNode;
};

export function DocTestPanel({
  title,
  subtitle,
  prerequisites,
  phases,
  passCriteria,
  failActions,
}: {
  title: string;
  subtitle?: string;
  prerequisites: string[];
  phases: {
    id: string;
    title: string;
    description?: string;
    rows: DocTestCaseRow[];
  }[];
  passCriteria: string[];
  failActions?: string[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-primary/25 bg-card shadow-sm ring-1 ring-primary/10">
      <div className="flex items-start gap-3 border-b border-primary/20 bg-primary/5 px-4 py-3">
        <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-5 p-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Prerequisites
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-foreground/90">
            {prerequisites.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        {phases.map((phase) => (
          <div key={phase.id}>
            <p className="mb-1 text-sm font-semibold text-foreground">
              {phase.title}
            </p>
            {phase.description ? (
              <p className="mb-2 text-xs leading-5 text-muted-foreground">
                {phase.description}
              </p>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border/70 bg-muted/50">
                  <tr>
                    <th className="w-12 px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Pass if</th>
                    <th className="w-16 px-3 py-2 font-medium">☐</th>
                  </tr>
                </thead>
                <tbody>
                  {phase.rows.map((row) => (
                    <tr
                      key={row.step}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                        {row.step}
                      </td>
                      <td className="px-3 py-2 align-top text-foreground/90">
                        {row.action}
                      </td>
                      <td className="px-3 py-2 align-top text-foreground/90">
                        {row.expected}
                      </td>
                      <td className="px-3 py-2 align-top text-muted-foreground">
                        ☐
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-3 dark:border-emerald-500/30">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Migration passes only if ALL are true
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-foreground/90">
            {passCriteria.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        {failActions && failActions.length > 0 ? (
          <div className="rounded-lg border border-amber-600/30 bg-amber-500/5 p-3 dark:border-amber-500/30">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-400">
              If any step fails
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-foreground/90">
              {failActions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
