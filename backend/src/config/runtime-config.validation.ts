/** Validates production runtime config written to AppSettings (admin panel). */

export function validateMetaPixelId(input: string): string {
  const value = String(input ?? "").trim();
  if (!/^\d{15,16}$/.test(value)) {
    throw new Error(
      "META_PIXEL_ID must be a 15 or 16 digit numeric Meta Pixel ID",
    );
  }
  return value;
}

export function validateWebsiteDomainInput(input: string): string {
  let url: URL;
  try {
    url = new URL(String(input ?? "").trim());
  } catch {
    throw new Error(
      "Website domain must be an HTTPS origin such as https://example.com",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Website domain must be a bare HTTPS origin");
  }
  const hostname = url.hostname.trim().toLowerCase();
  if (!hostname || hostname.includes("*")) {
    throw new Error("Website domain must be a public hostname");
  }
  if (hostname === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    throw new Error("Website domain must be a public hostname");
  }
  return hostname;
}
