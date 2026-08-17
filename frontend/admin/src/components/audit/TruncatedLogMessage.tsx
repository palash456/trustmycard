"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function TruncatedLogMessage({
  message,
  errorLine,
  className,
}: {
  message: string;
  errorLine?: string;
  className?: string;
}) {
  const fullText = errorLine ? `${message}\n${errorLine}` : message;

  return (
    <div className={className}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          className="block max-w-xs cursor-default truncate text-left text-xs"
        >
          {message}
        </TooltipTrigger>
        <TooltipContent className="max-w-md whitespace-pre-wrap">
          {fullText}
        </TooltipContent>
      </Tooltip>
      {errorLine ? (
        <span className="mt-0.5 block max-w-xs truncate text-xs text-destructive">
          {errorLine}
        </span>
      ) : null}
    </div>
  );
}
