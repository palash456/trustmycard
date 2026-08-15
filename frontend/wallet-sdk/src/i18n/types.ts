export type WalletSdkTranslateParams = Record<string, string | number>;

export type WalletSdkMessages = Record<string, unknown>;

export type WalletSdkTranslator = (
  key: string,
  params?: WalletSdkTranslateParams,
) => string;
