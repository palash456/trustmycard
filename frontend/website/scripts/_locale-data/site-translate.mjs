const SKIP_KEYS = new Set([
  "href",
  "id",
  "flag",
  "percent",
  "address",
  "wallet",
]);

export function translateSite(obj, dict) {
  if (typeof obj === "string") {
    return dict[obj] ?? obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => translateSite(item, dict));
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SKIP_KEYS.has(key)) {
        out[key] = value;
        continue;
      }
      out[key] = translateSite(value, dict);
    }
    return out;
  }
  return obj;
}

export function buildDict(enStrings, translations) {
  if (enStrings.length !== translations.length) {
    throw new Error(
      `Dict length mismatch: ${enStrings.length} en vs ${translations.length} translations`,
    );
  }
  return Object.fromEntries(
    enStrings.map((source, index) => [source, translations[index]]),
  );
}
