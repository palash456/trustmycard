export function deepMerge(target, source) {
  if (source === undefined) return target;
  if (Array.isArray(source)) return source.slice();
  if (
    source === null ||
    typeof source !== "object" ||
    typeof target !== "object" ||
    target === null
  ) {
    return source;
  }
  const out = { ...target };
  for (const [key, value] of Object.entries(source)) {
    out[key] =
      key in target && typeof value === "object" && !Array.isArray(value)
        ? deepMerge(target[key], value)
        : Array.isArray(value)
          ? value.slice()
          : value;
  }
  return out;
}
