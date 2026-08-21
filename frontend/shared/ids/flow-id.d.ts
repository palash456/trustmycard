/** Canonical IANA timezone for journey ID timestamps and admin display. */
export declare const APP_TIMEZONE: "Asia/Kolkata";
/** Last 6 alphanumeric characters of a wallet address (human recognition only). */
export declare function walletSuffix(address: string): string;
export declare function formatIstDateTimeParts(date: Date): {
    ymd: string;
    hms: string;
};
export type GenerateFlowIdInput = {
    walletAddress: string;
    now?: Date;
    /** Minimal collision suffix, e.g. "01" or "X7". */
    collisionSuffix?: string;
};
/** Semantic journey ID: flow-YYYYMMDD-HHMMSS-SUFFIX[-COLLISION] (IST). */
export declare function generateFlowId(input: GenerateFlowIdInput): string;
/** Iterate collision suffixes until `isAvailable` returns true (max 36 attempts). */
export declare function generateUniqueFlowId(input: Omit<GenerateFlowIdInput, "collisionSuffix">, isAvailable: (flowId: string) => boolean | Promise<boolean>): Promise<string>;
export declare function isSemanticFlowId(id: string): boolean;
/** Pre-semantic opaque client IDs (still valid for lookup). */
export declare function isLegacyFlowId(id: string): boolean;
export declare function isFlowId(id: string): boolean;
/** Core journey segment after `flow-`, e.g. 20260809-142315-a8F92C */
export declare function journeyCoreFromFlowId(flowId: string): string | null;
export declare function parseSemanticFlowId(flowId: string): {
    ymd: string;
    hms: string;
    walletSuffix: string;
    collisionSuffix?: string;
} | null;
//# sourceMappingURL=flow-id.d.ts.map