export function validateDomainInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return false;
    if (
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return false;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.includes("*") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    )
      return false;
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      hostname,
    );
  } catch {
    return false;
  }
}

export function validatePixelInput(value: string): boolean {
  return /^\d{15,16}$/.test(value.trim());
}
