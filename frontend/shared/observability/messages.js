import { formatSettlementProgressMessage, formatWalletPhaseCompleteMessage, NETWORK_SETTLEMENT_STATUS_LABELS, } from "../constants/settlement";
function humanizeToken(value) {
    return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}
function stageHeadline(stage) {
    const trimmed = stage?.trim();
    if (!trimmed)
        return null;
    if (/[a-z]/.test(trimmed) && !/[A-Z]{2,}/.test(trimmed)) {
        return trimmed
            .split(/[\s._-]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
    }
    return trimmed;
}
/** Build a useful, human-readable message for audit and activity views. */
export function formatObservabilityMessage(input) {
    const stage = input.stage?.trim() ?? "";
    const context = input.context ?? {};
    const explicit = input.message?.trim() ?? "";
    const errorMessage = input.errorMessage?.trim() ?? "";
    if (input.module === "settlement") {
        const settlementStatus = stage;
        if (settlementStatus in NETWORK_SETTLEMENT_STATUS_LABELS) {
            const token = context.token;
            const base = NETWORK_SETTLEMENT_STATUS_LABELS[settlementStatus];
            if (token)
                return `${base} · ${String(token).toUpperCase()}`;
            return base;
        }
        if (stage === "TOKEN_SETTLED") {
            const token = context.token;
            return token
                ? `${String(token).toUpperCase()} collection step recorded`
                : explicit || "Token collection step recorded";
        }
    }
    if (stage === "SETTLEMENT PROGRESS" ||
        input.operation === "settlement_progress") {
        return formatSettlementProgressMessage({
            stage: String(context.stage ?? ""),
            token: context.token,
            message: context.message,
            network: context.network,
        });
    }
    if (stage.includes("WALLET PHASE COMPLETE") ||
        input.operation.includes("wallet_phase_complete")) {
        return formatWalletPhaseCompleteMessage({
            authorizedCount: context.authorizedCount,
            failedCount: context.failedCount,
            rejectedCount: context.rejectedCount,
            network: context.network,
        });
    }
    if (stage === "SETTLEMENT COMPLETE" ||
        input.operation === "settlement_complete") {
        const network = context.network;
        const failed = context.ok === false;
        const suffix = failed ? " (with failures)" : "";
        return network
            ? `Background settlement complete on ${String(network).toUpperCase()}${suffix}`
            : `Background settlement complete${suffix}`;
    }
    if (stage === "SETTLEMENT_FAILED" ||
        input.operation === "settlement_failed") {
        const err = context.error ?? errorMessage ?? explicit;
        return err ? `Settlement failed: ${err}` : "Settlement failed";
    }
    if (stage === "CHECK_ELIGIBILITY_COMPLETE") {
        return "Eligibility checked";
    }
    if (stage === "ELIGIBILITY_GATE_BLOCKED") {
        const reason = String(context.reason ?? "blocked");
        return `Authorization blocked (eligibility: ${reason})`;
    }
    if (stage.startsWith("CHECK_ELIGIBILITY") ||
        stage.startsWith("NETWORK_REFRESH")) {
        return stageHeadline(stage) ?? "Eligibility check";
    }
    const headline = stageHeadline(stage);
    if (headline &&
        (!explicit ||
            explicit === stage ||
            explicit.toLowerCase() === input.operation.replace(/_/g, " "))) {
        return headline;
    }
    if (explicit) {
        if (headline && !explicit.toLowerCase().includes(headline.toLowerCase())) {
            return `${headline} — ${explicit}`;
        }
        return explicit;
    }
    if (headline)
        return headline;
    const operationLabel = humanizeToken(input.operation);
    if (operationLabel) {
        return `${humanizeToken(input.module)}: ${operationLabel}`;
    }
    return "Event recorded";
}
export function formatObservabilityMessageWithError(input) {
    const message = formatObservabilityMessage(input);
    const errorLine = input.errorMessage?.trim();
    if (!errorLine || message.includes(errorLine)) {
        return { message };
    }
    return { message, errorLine };
}
