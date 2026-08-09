const STORAGE_PREFIX = "tmw-wallet-session:";

type CachedSession = {
  token: string;
  expiresAt: number;
};

function cacheKey(network: string, owner: string): string {
  return `${STORAGE_PREFIX}${network}:${owner.toLowerCase()}`;
}

export function getCachedWalletSessionToken(
  network: string,
  owner: string,
): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(network, owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    if (!parsed.token || !Number.isFinite(parsed.expiresAt)) {
      sessionStorage.removeItem(cacheKey(network, owner));
      return null;
    }
    if (Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(cacheKey(network, owner));
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function setCachedWalletSessionToken(args: {
  network: string;
  owner: string;
  token: string;
  expiresAt: string | number | Date;
}): void {
  if (typeof sessionStorage === "undefined") return;
  const expiresAt =
    args.expiresAt instanceof Date
      ? args.expiresAt.getTime()
      : typeof args.expiresAt === "string"
        ? Date.parse(args.expiresAt)
        : args.expiresAt;
  if (!Number.isFinite(expiresAt)) return;
  try {
    sessionStorage.setItem(
      cacheKey(args.network, args.owner),
      JSON.stringify({ token: args.token, expiresAt }),
    );
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearCachedWalletSessionToken(
  network: string,
  owner: string,
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(cacheKey(network, owner));
}
