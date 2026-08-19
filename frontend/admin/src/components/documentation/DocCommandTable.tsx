"use client";

import { CopyButton } from "@/components/CopyButton";
import type {
  EssentialCommandGroup,
} from "@/lib/documentation/essential-commands";
import { cn } from "@/lib/utils";

export function DocCommandTable({
  groups,
  className,
}: {
  groups: EssentialCommandGroup[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-8", className)}>
      {groups.map((group) => (
        <div key={group.id} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {group.title}
            </h3>
            {group.hint ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {group.hint}
              </p>
            ) : null}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-border/70 bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-medium text-foreground w-[18%]">
                    Command
                  </th>
                  <th className="px-3 py-2 font-medium text-foreground w-[42%]">
                    Terminal
                  </th>
                  <th className="px-3 py-2 font-medium text-foreground">
                    Description
                  </th>
                  <th className="px-3 py-2 w-16 text-right font-medium text-foreground">
                    <span className="sr-only">Copy</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.commands.map((cmd) => (
                  <tr
                    key={cmd.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-3 py-2.5 align-top font-medium text-foreground">
                      {cmd.title}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <code
                        className="block rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[0.75rem] leading-5 text-foreground/95 break-all"
                      >
                        {cmd.command}
                      </code>
                    </td>
                    <td className="px-3 py-2.5 align-top text-xs leading-relaxed text-muted-foreground">
                      {cmd.description}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right">
                      <CopyButton
                        value={cmd.command}
                        variant="text"
                        label="Copy"
                        ariaLabel={`Copy command: ${cmd.title}`}
                        className="shrink-0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
