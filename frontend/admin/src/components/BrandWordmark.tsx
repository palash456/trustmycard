import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandWordmark({
  className,
  size = "md",
  collapsed = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  collapsed?: boolean;
}) {
  const heights = {
    sm: "h-7",
    md: "h-9",
    lg: "h-12",
  };

  if (collapsed) {
    return (
      <Image
        src="/brand/logo-mark.png"
        alt="Crypto Visa Card Admin"
        width={263}
        height={326}
        className={cn("h-8 w-auto object-contain", className)}
        unoptimized
        priority
      />
    );
  }

  return (
    <Image
      src="/brand/logo-wordmark.png"
      alt="Crypto Visa Card Admin"
      width={1507}
      height={328}
      className={cn("w-auto object-contain", heights[size], className)}
      unoptimized
      priority
    />
  );
}
