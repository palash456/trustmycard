"use client";

import Image from "next/image";
import { memo } from "react";

type CardImageProps = {
  src: string;
  alt: string;
  size: "list" | "hero" | "display";
  className?: string;
  priority?: boolean;
};

const FIXED: Record<
  "list" | "hero",
  { width: number; height: number; frame: string }
> = {
  list: {
    width: 82,
    height: 52,
    frame: "inline-block shrink-0 rounded-lg",
  },
  hero: {
    width: 190,
    height: 121,
    frame: "inline-block shrink-0 rounded-xl shadow-lg",
  },
};

function CardImageInner({
  src,
  alt,
  size,
  className = "",
  priority = false,
}: CardImageProps) {
  if (size === "display") {
    return (
      <span
        className={[
          "relative block w-full max-w-[280px] shrink-0 aspect-[1.57/1] rounded-2xl sm:max-w-sm",
          className,
        ].join(" ")}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 640px) 280px, 384px"
          quality={75}
          priority={priority}
          className="object-contain"
        />
      </span>
    );
  }

  const { width, height, frame } = FIXED[size];

  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size modal thumbnails; avoids Next image pipeline latency.
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={[frame, "h-auto object-contain", className].join(" ")}
    />
  );
}

export const CardImage = memo(CardImageInner);
