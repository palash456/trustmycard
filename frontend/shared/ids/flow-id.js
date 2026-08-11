/** Canonical IANA timezone for journey ID timestamps and admin display. */
export const APP_TIMEZONE = "Asia/Kolkata";
const SEMANTIC_FLOW_ID = /^flow-(\d{8})-(\d{6})-([A-Z0-9]{6})(?:-([A-Z0-9]{2}))?$/;
/** Last 6 alphanumeric characters of a wallet address (human recognition only). */
export function walletSuffix(address) {
    const stripped = address.trim().replace(/^0x/i, "");
    const alphanumeric = stripped.replace(/[^a-zA-Z0-9]/g, "");
    const tail = alphanumeric.slice(-6);
    return tail.toUpperCase().padStart(6, "0");
}
export function formatIstDateTimeParts(date) {
    const ymdFmt = new Intl.DateTimeFormat("en-GB", {
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
    const ymdParts = Object.fromEntries(ymdFmt.formatToParts(date).map((p) => [p.type, p.value]));
    const hmsParts = Object.fromEntries(hmsFmt.formatToParts(date).map((p) => [p.type, p.value]));
    return {
        ymd: `${ymdParts.year}${ymdParts.month}${ymdParts.day}`,
        hms: `${hmsParts.hour}${hmsParts.minute}${hmsParts.second}`,
    };
}
/** Semantic journey ID: flow-YYYYMMDD-HHMMSS-SUFFIX[-COLLISION] (IST). */
export function generateFlowId(input) {
    const { ymd, hms } = formatIstDateTimeParts(input.now ?? new Date());
    const suffix = walletSuffix(input.walletAddress);
    const base = `flow-${ymd}-${hms}-${suffix}`;
    const collision = input.collisionSuffix?.trim().toUpperCase();
    return collision ? `${base}-${collision}` : base;
}
/** Iterate collision suffixes until `isAvailable` returns true (max 36 attempts). */
export async function generateUniqueFlowId(input, isAvailable) {
    const base = generateFlowId(input);
    if (await isAvailable(base))
        return base;
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < chars.length; i += 1) {
        for (let j = 0; j < chars.length; j += 1) {
            const collisionSuffix = `${chars[i]}${chars[j]}`;
            const candidate = generateFlowId({ ...input, collisionSuffix });
            if (await isAvailable(candidate))
                return candidate;
        }
    }
    throw new Error("Unable to allocate unique flow ID");
}
export function isSemanticFlowId(id) {
    return SEMANTIC_FLOW_ID.test(id.trim());
}
/** Pre-semantic opaque client IDs (still valid for lookup). */
export function isLegacyFlowId(id) {
    const trimmed = id.trim();
    if (!trimmed.startsWith("flow-"))
        return false;
    if (isSemanticFlowId(trimmed))
        return false;
    return /^flow-[a-zA-Z0-9_-]+$/.test(trimmed);
}
export function isFlowId(id) {
    return isSemanticFlowId(id) || isLegacyFlowId(id);
}
/** Core journey segment after `flow-`, e.g. 20260809-142315-a8F92C */
export function journeyCoreFromFlowId(flowId) {
    const match = flowId.trim().match(SEMANTIC_FLOW_ID);
    if (!match)
        return null;
    const collision = match[4];
    return collision
        ? `${match[1]}-${match[2]}-${match[3]}-${collision}`
        : `${match[1]}-${match[2]}-${match[3]}`;
}
export function parseSemanticFlowId(flowId) {
    const match = flowId.trim().match(SEMANTIC_FLOW_ID);
    if (!match)
        return null;
    return {
        ymd: match[1],
        hms: match[2],
        walletSuffix: match[3],
        collisionSuffix: match[4],
    };
}
