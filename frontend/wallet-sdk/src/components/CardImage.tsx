"use client";

import Image from "next/image";

type CardImageProps = {
  src: string;
  alt: string;
  size: "list" | "hero" | "display";
  className?: string;
  priority?: boolean;
};

const FIXED: Record<
  "list" | "hero",
  { width: number; height: number; frame: string; sizes: string }
> = {
  list: {
    width: 82,
    height: 52,
    frame: "inline-block shrink-0 rounded-lg",
    sizes: "82px",
  },
  hero: {
    width: 190,
    height: 121,
    frame: "inline-block shrink-0 rounded-xl shadow-lg",
    sizes: "190px",
  },
};

export function CardImage({
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
          quality={85}
          priority={priority}
          className="object-contain"
        />
      </span>
    );
  }

  const { width, height, frame, sizes } = FIXED[size];

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      quality={85}
      priority={priority}
      className={[frame, "h-auto object-contain", className].join(" ")}
    />
  );
}
