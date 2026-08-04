"use client";

import { memo } from "react";
import { NETWORK_DISPLAY } from "../core/link-flow-meta";

type NetworkIconProps = {
  networkKey: string;
  name: string;
  priority?: boolean;
};

function NetworkIconInner({
  networkKey,
  name,
  priority = false,
}: NetworkIconProps) {
  const icon = NETWORK_DISPLAY[networkKey]?.icon;
  if (icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- fixed 40px modal icons; optimized PNG from original assets.
      <img
        src={icon}
        alt={name}
        width={40}
        height={40}
        loading="eager"
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-600">
      {name.slice(0, 1)}
    </span>
  );
}

export const NetworkIcon = memo(NetworkIconInner);
