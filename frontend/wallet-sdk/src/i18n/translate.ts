import type {
  WalletSdkMessages,
  WalletSdkTranslateParams,
  WalletSdkTranslator,
} from "./types";
import { WALLET_SDK_DEFAULT_MESSAGES } from "./defaults";

function resolvePath(messages: WalletSdkMessages, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = messages;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function interpolate(
  template: string,
  params?: WalletSdkTranslateParams,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

function deepMerge(
  base: WalletSdkMessages,
  override?: WalletSdkMessages,
): WalletSdkMessages {
  if (!override) return base;

  const result: WalletSdkMessages = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof base[key] === "object" &&
      base[key] != null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(
        base[key] as WalletSdkMessages,
        value as WalletSdkMessages,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function deepMergeMessages(
  base: WalletSdkMessages,
  override?: WalletSdkMessages,
): WalletSdkMessages {
  return deepMerge(base, override);
}

export function createWalletSdkTranslator(
  overrideMessages?: WalletSdkMessages,
): WalletSdkTranslator {
  const messages = deepMerge(WALLET_SDK_DEFAULT_MESSAGES, overrideMessages);

  return function walletSdkT(
    key: string,
    params?: WalletSdkTranslateParams,
  ): string {
    const value = resolvePath(messages, key);
    if (typeof value === "string") {
      return interpolate(value, params);
    }
    const fallback = resolvePath(WALLET_SDK_DEFAULT_MESSAGES, key);
    if (typeof fallback === "string") {
      return interpolate(fallback, params);
    }
    return key;
  };
}

export function walletSdkMessagesArray(
  messages: WalletSdkMessages,
  key: string,
): string[] {
  const value = resolvePath(messages, key);
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}
