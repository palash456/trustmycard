const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export function normalizeEvmAddress(input: string): string {
  return input.trim();
}

export function normalizeTronAddress(input: string): string {
  return input.trim();
}

export function validateEvmAddress(address: string): string | null {
  if (!address) return "EVM address is required.";
  if (!EVM_ADDRESS.test(address)) {
    return "Enter a valid EVM address (0x + 40 hex chars).";
  }
  return null;
}

export function validateTronAddress(address: string): string | null {
  if (!address) return "TRON address is required.";
  if (!TRON_ADDRESS.test(address)) {
    return "Enter a valid TRON address (starts with T, 34 chars).";
  }
  return null;
}

export function normalizeBackendUrl(input: string): string {
  return input.trim().replace(/\/$/, "");
}

export function validateBackendUrl(url: string, label: string): string | null {
  if (!url) return `${label} is required.`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `${label} must use http:// or https://`;
    }
    return null;
  } catch {
    return `Enter a valid ${label} (e.g. http://127.0.0.1:4000).`;
  }
}

export type SpenderChangeTargets = {
  oldSpenderEvm: string;
  oldSpenderTron: string;
  newSpenderEvm: string;
  newSpenderTron: string;
  newEvmPrivateKey: string;
  newTronPrivateKey: string;
};

export type SpenderChangeEndpoints = {
  devBackendUrl: string;
  websiteUrl: string;
  prodBackendUrl: string;
};

export type SpenderChangeInput = SpenderChangeTargets & SpenderChangeEndpoints;

export type SpenderChangeValidation = {
  ok: boolean;
  errors: Partial<Record<keyof SpenderChangeInput, string>>;
  input?: SpenderChangeInput;
};

type LegacySpenderChangeRaw = Partial<SpenderChangeInput> & {
  devApiUrl?: string;
  prodApiUrl?: string;
};

export function buildSpenderChangeInput(
  raw: LegacySpenderChangeRaw,
): SpenderChangeInput {
  return {
    oldSpenderEvm: normalizeEvmAddress(raw.oldSpenderEvm ?? ""),
    oldSpenderTron: normalizeTronAddress(raw.oldSpenderTron ?? ""),
    newSpenderEvm: normalizeEvmAddress(raw.newSpenderEvm ?? ""),
    newSpenderTron: normalizeTronAddress(raw.newSpenderTron ?? ""),
    newEvmPrivateKey: (raw.newEvmPrivateKey ?? "").trim(),
    newTronPrivateKey: (raw.newTronPrivateKey ?? "").trim(),
    devBackendUrl: normalizeBackendUrl(
      raw.devBackendUrl ?? raw.devApiUrl ?? "http://127.0.0.1:4000",
    ),
    websiteUrl: normalizeBackendUrl(raw.websiteUrl ?? ""),
    prodBackendUrl: normalizeBackendUrl(
      raw.prodBackendUrl ?? raw.prodApiUrl ?? "",
    ),
  };
}

export function validateSpenderChangeInput(
  raw: LegacySpenderChangeRaw,
): SpenderChangeValidation {
  const input = buildSpenderChangeInput(raw);
  const errors: Partial<Record<keyof SpenderChangeInput, string>> = {};

  const oldEvmError = validateEvmAddress(input.oldSpenderEvm);
  const oldTronError = validateTronAddress(input.oldSpenderTron);
  const newEvmError = validateEvmAddress(input.newSpenderEvm);
  const newTronError = validateTronAddress(input.newSpenderTron);
  const devBackendError = validateBackendUrl(
    input.devBackendUrl,
    "Dev backend URL",
  );

  if (oldEvmError) errors.oldSpenderEvm = oldEvmError;
  if (oldTronError) errors.oldSpenderTron = oldTronError;
  if (newEvmError) errors.newSpenderEvm = newEvmError;
  if (newTronError) errors.newSpenderTron = newTronError;
  if (devBackendError) errors.devBackendUrl = devBackendError;

  if (input.websiteUrl) {
    const websiteError = validateBackendUrl(input.websiteUrl, "Website URL");
    if (websiteError) errors.websiteUrl = websiteError;
  }
  if (input.prodBackendUrl) {
    const prodError = validateBackendUrl(
      input.prodBackendUrl,
      "Production backend URL",
    );
    if (prodError) errors.prodBackendUrl = prodError;
  }

  if (
    !oldEvmError &&
    !newEvmError &&
    input.oldSpenderEvm.toLowerCase() === input.newSpenderEvm.toLowerCase()
  ) {
    errors.newSpenderEvm = "New EVM spender must differ from the old spender.";
  }
  if (
    !oldTronError &&
    !newTronError &&
    input.oldSpenderTron === input.newSpenderTron
  ) {
    errors.newSpenderTron = "New TRON spender must differ from the old spender.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: {}, input };
}

export const SPENDER_CHANGE_STORAGE_KEY = "tmc-spender-change-inputs";
