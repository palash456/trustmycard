"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  value: string;
  label?: string;
  variant?: "text" | "icon";
  className?: string;
  ariaLabel?: string;
};

export function CopyButton({
  value,
  label = "Copy",
  variant = "text",
  className,
  ariaLabel,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void copy();
        }}
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
          className,
        )}
        title={copied ? "Copied" : ariaLabel ?? "Copy"}
        aria-label={copied ? "Copied" : ariaLabel ?? "Copy"}
      >
        {copied ? (
          <Check className="size-3 text-emerald-600" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted",
        className,
      )}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
