import { APP_TIMEZONE } from "./flow-id";
/** Format an instant for admin/human display in IST. Storage remains UTC. */
export function formatInstantIst(value, options) {
    if (!value)
        return "—";
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime()))
        return "—";
    return d.toLocaleString("en-IN", {
        timeZone: APP_TIMEZONE,
        dateStyle: "medium",
        timeStyle: "medium",
        ...options,
    });
}
