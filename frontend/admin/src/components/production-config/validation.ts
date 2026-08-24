export function validateDomainInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return false;
    if (
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return false;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.includes("*") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    )
      return false;
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      hostname,
    );
  } catch {
    return false;
  }
}

export function validatePixelInput(value: string): boolean {
  return /^\d{15,16}$/.test(value.trim());
}

export type FieldInputValidation = {
  canSubmit: boolean;
  error: string | null;
  successHint: string | null;
};

export function validateDomainFieldInput(value: string): FieldInputValidation {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      canSubmit: false,
      error: "Domain is required.",
      successHint: null,
    };
  }
  if (!validateDomainInput(trimmed)) {
    return {
      canSubmit: false,
      error: "Enter a valid HTTPS domain.",
      successHint: null,
    };
  }
  return { canSubmit: true, error: null, successHint: null };
}

export function validatePixelFieldInput(
  value: string,
  currentPixelId: string,
): FieldInputValidation {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      canSubmit: false,
      error: "Pixel ID is required.",
      successHint: null,
    };
  }
  if (!validatePixelInput(trimmed)) {
    return {
      canSubmit: false,
      error: "Invalid Pixel ID. Enter a valid Meta Pixel ID to continue.",
      successHint: null,
    };
  }
  const current = currentPixelId.trim();
  if (current && trimmed === current) {
    return {
      canSubmit: false,
      error:
        "This Pixel ID is already configured. Enter a different Pixel ID to continue.",
      successHint: null,
    };
  }
  return {
    canSubmit: true,
    error: null,
    successHint: "Valid Pixel ID",
  };
}

export function validateConfigFieldInput(
  field: "domain" | "pixel",
  value: string,
  currentPixelId: string,
): FieldInputValidation {
  return field === "domain"
    ? validateDomainFieldInput(value)
    : validatePixelFieldInput(value, currentPixelId);
}
