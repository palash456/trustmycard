function flagEmoji(countryCode: string): string {
  const cc = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + (cc.charCodeAt(0) - 65),
    A + (cc.charCodeAt(1) - 65)
  );
}

export async function lookupLocation(ip: string): Promise<string> {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") {
    return "Local";
  }
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city,countryCode`,
      { cache: "no-store" }
    );
    if (!res.ok) return "Unknown";
    const json = (await res.json()) as {
      status?: string;
      country?: string;
      city?: string;
      countryCode?: string;
    };
    if (json.status !== "success") return "Unknown";
    const flag = json.countryCode ? ` ${flagEmoji(json.countryCode)}` : "";
    const city = json.city?.trim();
    const country = json.country?.trim();
    if (country && city) return `${country}, ${city}${flag}`;
    if (country) return `${country}${flag}`;
    return "Unknown";
  } catch {
    return "Unknown";
  }
}
