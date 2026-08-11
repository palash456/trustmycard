import { journeyCoreFromFlowId } from "./flow-id";
/** Normalize token symbol for public IDs (usdt, usdc). */
export function tokenQualifier(tokenSymbol) {
    return tokenSymbol
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}
/** Network or asset qualifier for native/settlement IDs. */
export function networkQualifier(network, assetSymbol) {
    const net = network.trim().toLowerCase();
    if (assetSymbol) {
        const asset = assetSymbol.trim().toLowerCase();
        if (asset && asset !== net)
            return `${asset}`;
    }
    return net;
}
/**
 * Semantic business-facing ID for child records.
 * Sequence suffix (-02, -03) when multiple identical children exist in one journey.
 */
export function generatePublicId(kind, qualifier, journeyId, sequence) {
    const q = qualifier
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const core = journeyCoreFromFlowId(journeyId) ??
        journeyId
            .trim()
            .replace(/^flow-/, "")
            .slice(0, 48);
    const seq = sequence != null && sequence > 1
        ? `-${String(sequence).padStart(2, "0")}`
        : "";
    return `${kind}-${q}-${core}${seq}`;
}
export function publicIdPrefix(kind, qualifier, journeyId) {
    return generatePublicId(kind, qualifier, journeyId);
}
