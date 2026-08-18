import type { TranslateParams, TranslationMessages } from "./types";

function resolvePath(messages: TranslationMessages, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = messages;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function createTranslator(
  messages: TranslationMessages,
  fallbackMessages?: TranslationMessages,
) {
  function t(key: string, params?: TranslateParams): string {
    const value = resolvePath(messages, key);

    if (typeof value === "string") {
      return interpolate(value, params);
    }

    if (fallbackMessages) {
      const fallback = resolvePath(fallbackMessages, key);
      if (typeof fallback === "string") {
        return interpolate(fallback, params);
      }
    }

    if (value === undefined) {
      return key;
    }

    return String(value);
  }

  function tArray(key: string): string[] {
    const value = resolvePath(messages, key);
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  function tRaw<T = unknown>(key: string): T | undefined {
    return resolvePath(messages, key) as T | undefined;
  }

  return { t, tArray, tRaw };
}
