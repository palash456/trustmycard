import { APP_TIMEZONE } from "@trustmycard/shared/ids";

/** Asia/Kolkata has no DST — fixed offset from UTC. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const TIME_HMS = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

export type IstDateTimeParts = {
  date: string;
  time: string;
};

/** Parse `HH:mm:ss` (seconds required). */
export function isValidTimeHms(value: string): boolean {
  return TIME_HMS.test(value.trim());
}

export function isValidDateYmd(value: string): boolean {
  if (!DATE_YMD.test(value.trim())) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/**
 * Convert an IST wall-clock date + `HH:mm:ss` into a UTC ISO string
 * for API `from` / `to` filters.
 */
export function istLocalToUtcIso(
  dateYmd: string,
  timeHms: string,
): string | null {
  const date = dateYmd.trim();
  const time = timeHms.trim();
  if (!isValidDateYmd(date) || !isValidTimeHms(time)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, ss) - IST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

/** Split a UTC ISO instant into IST date (`YYYY-MM-DD`) and time (`HH:mm:ss`). */
export function utcIsoToIstParts(
  value: string | null | undefined,
): IstDateTimeParts | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const ymdFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const hmsFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const ymdParts = Object.fromEntries(
    ymdFmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  const hmsParts = Object.fromEntries(
    hmsFmt.formatToParts(d).map((p) => [p.type, p.value]),
  );

  const hour = (hmsParts.hour === "24" ? "00" : hmsParts.hour) ?? "00";
  return {
    date: `${ymdParts.year}-${ymdParts.month}-${ymdParts.day}`,
    time: `${hour}:${hmsParts.minute}:${hmsParts.second}`,
  };
}

/** Today's date in IST as `YYYY-MM-DD`. */
export function todayIstYmd(now = new Date()): string {
  return (
    utcIsoToIstParts(now.toISOString())?.date ??
    now.toISOString().slice(0, 10)
  );
}
