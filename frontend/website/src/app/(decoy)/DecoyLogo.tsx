"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DECOY_LOGO_VERSION, decoyLogoSrc, decoyLogoWhiteSrc } from "./media";

type DecoyLogoProps = {
  variant?: "header" | "footer" | "compact";
  href?: string | null;
  className?: string;
};

const VARIANTS = {
  header: "h-9 w-auto sm:h-10",
  footer: "h-10 w-auto sm:h-11",
  compact: "h-8 w-auto",
} as const;

export function DecoyLogo({
  variant = "header",
  href = "/",
  className = "",
}: DecoyLogoProps) {
  const [src, setSrc] = useState(() =>
    variant === "footer" ? decoyLogoWhiteSrc() : decoyLogoSrc(),
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const srcFn = variant === "footer" ? decoyLogoWhiteSrc : decoyLogoSrc;
    setSrc(srcFn(`${DECOY_LOGO_VERSION}-${Date.now()}`));
  }, [variant]);

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- local asset; avoids Next image optimizer cache
    <img
      src={src}
      alt="Travixa"
      className={`${VARIANTS[variant]} ${className}`.trim()}
      decoding="async"
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 items-center" aria-label="Travixa home">
        {image}
      </Link>
    );
  }

  return image;
}
