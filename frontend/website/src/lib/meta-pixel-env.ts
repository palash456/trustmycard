export type NormalizeAppOriginOptions = {
  /** Production Meta Pixel requires HTTPS origins only. */
  requireHttps?: boolean;
};

/** Normalize to origin (protocol + host + port); rejects paths and invalid URLs. */
export function normalizeAppOrigin(
  url: string,
  options?: NormalizeAppOriginOptions,
): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (options?.requireHttps) {
      if (parsed.protocol !== "https:") return null;
    } else if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export type MetaPixelEnvConfig = {
  pixelId: string;
};

/** Returns pixel config when production env matches the canonical META_PIXEL_APP_URL origin. */
export function getMetaPixelEnvConfig(): MetaPixelEnvConfig | null {
  if (process.env.TMC_ENV !== "production") return null;

  const pixelId = process.env.META_PIXEL_ID?.trim();
  if (!pixelId) return null;

  const canonicalOrigin = normalizeAppOrigin(
    process.env.META_PIXEL_APP_URL ?? "",
    {
      requireHttps: true,
    },
  );
  if (!canonicalOrigin) return null;

  const appOrigin = normalizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL ?? "", {
    requireHttps: true,
  });
  if (!appOrigin || appOrigin !== canonicalOrigin) return null;

  return { pixelId };
}
