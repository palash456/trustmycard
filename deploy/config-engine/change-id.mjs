import { readAuditHistory } from "./audit.mjs";
export function allocateChangeId(
  clock = () => new Date(),
  environment = "production",
) {
  const prefix = `CFG-${clock().toISOString().slice(0, 10).replaceAll("-", "")}-`;
  const next =
    readAuditHistory(environment, { limit: 10000 })
      .filter((item) => item.changeId?.startsWith(prefix))
      .reduce(
        (max, item) =>
          Math.max(max, Number(item.changeId.slice(prefix.length)) || 0),
        0,
      ) + 1;
  return `${prefix}${String(next).padStart(6, "0")}`;
}
