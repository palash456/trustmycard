/** Shared .env parse + merge helpers for bootstrap/export scripts. */

const EMPTY_VALUES = new Set([
  "",
  '""',
  "''",
  "change-me-in-development",
  "change-me-in-production",
]);

export function isEmptyEnvValue(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return true;
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return EMPTY_VALUES.has(normalized.slice(1, -1));
  }
  return EMPTY_VALUES.has(normalized);
}

export function parseEnvValue(raw) {
  const value = String(raw ?? "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function formatEnvValue(value) {
  const text = String(value ?? "");
  if (/^[A-Za-z0-9_./:@,-]+$/.test(text)) return text;
  if (text.includes('"')) return `'${text}'`;
  return `"${text}"`;
}

/** @returns {Map<string, { line: string, value: string }>} */
export function parseEnvEntries(content) {
  const entries = new Map();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = parseEnvValue(trimmed.slice(eq + 1));
    entries.set(key, { line, value });
  }
  return entries;
}

export function envKeysInContent(content) {
  return new Set(parseEnvEntries(content).keys());
}

/** Append template keys missing from an existing .env file. */
export function mergeEnvFromExample(sourceContent, targetContent) {
  const targetKeys = envKeysInContent(targetContent);
  const missingLines = [];

  for (const line of sourceContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!targetKeys.has(key)) {
      missingLines.push(line);
    }
  }

  if (!missingLines.length) return null;

  const needsNewline = targetContent.length > 0 && !targetContent.endsWith("\n");
  const banner =
    "\n# --- added by npm run setup (missing keys from template) ---\n";
  return (
    targetContent +
    (needsNewline ? "\n" : "") +
    banner +
    missingLines.join("\n") +
    "\n"
  );
}

/**
 * Fill empty / placeholder values in base from overlay.
 * Existing non-empty values in base are never overwritten.
 */
export function mergeEnvFillEmpty(baseContent, overlayContent) {
  const overlay = parseEnvEntries(overlayContent);
  if (!overlay.size) return null;

  const lines = baseContent.split("\n");
  let changed = false;
  const seen = new Set();

  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;

    const key = trimmed.slice(0, eq).trim();
    if (!overlay.has(key)) return line;

    const current = parseEnvValue(trimmed.slice(eq + 1));
    if (!isEmptyEnvValue(current)) {
      seen.add(key);
      return line;
    }

    const next = overlay.get(key).value;
    if (isEmptyEnvValue(next)) {
      seen.add(key);
      return line;
    }

    changed = true;
    seen.add(key);
    return `${key}=${formatEnvValue(next)}`;
  });

  const appended = [];
  for (const [key, entry] of overlay) {
    if (seen.has(key) || isEmptyEnvValue(entry.value)) continue;
    appended.push(`${key}=${formatEnvValue(entry.value)}`);
  }

  if (!changed && !appended.length) return null;

  let result = out.join("\n");
  if (appended.length) {
    const needsNewline = result.length > 0 && !result.endsWith("\n");
    result +=
      (needsNewline ? "\n" : "") +
      "\n# --- added by npm run setup (secrets overlay) ---\n" +
      appended.join("\n") +
      "\n";
  }

  return result;
}
