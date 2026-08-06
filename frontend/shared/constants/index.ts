/**
 * Platform-wide constants (chain IDs, token symbols, status enums as const, etc.).
 */

export const PLATFORM_NAME = "Trust My Card" as const;

export const API_VERSION = "v1" as const;

export * from "./collection";
export * from "./collector";
export * from "./native-chains";
export * from "./native-transfer-errors";
export * from "./self-spender";
export * from "./settlement";
export * from "./token-collection-state";
