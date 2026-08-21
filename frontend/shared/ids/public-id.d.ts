export type PublicIdKind = "approval" | "transfer" | "transfer-native" | "settlement" | "collect";
/** Normalize token symbol for public IDs (usdt, usdc). */
export declare function tokenQualifier(tokenSymbol: string): string;
/** Network or asset qualifier for native/settlement IDs. */
export declare function networkQualifier(network: string, assetSymbol?: string): string;
/**
 * Semantic business-facing ID for child records.
 * Sequence suffix (-02, -03) when multiple identical children exist in one journey.
 */
export declare function generatePublicId(kind: PublicIdKind, qualifier: string, journeyId: string, sequence?: number): string;
export declare function publicIdPrefix(kind: PublicIdKind, qualifier: string, journeyId: string): string;
//# sourceMappingURL=public-id.d.ts.map