const DOMAIN_LABEL =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const DOMAIN_HOSTNAME =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/** Strip protocol, path, trailing dot/slash — returns hostname only. */
export function normalizeDomainInput(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//i, "");
  value = value.replace(/\/.*$/, "");
  value = value.replace(/\.+$/, "");
  return value;
}

export function validateDomainHostname(hostname: string): string | null {
  if (!hostname) return "Domain is required.";
  if (/[:/\\]/.test(hostname) || hostname.includes(" ")) {
    return "Enter the domain only (no https:// or paths).";
  }
  if (!DOMAIN_HOSTNAME.test(hostname)) {
    return "Enter a valid domain (e.g. new-domain.example).";
  }
  const labels = hostname.split(".");
  for (const label of labels) {
    if (!DOMAIN_LABEL.test(label)) {
      return "Enter a valid domain (e.g. new-domain.example).";
    }
  }
  return null;
}

export type MigrationDomains = {
  oldDomain: string;
  newDomain: string;
  oldOrigin: string;
  newOrigin: string;
  oldApi: string;
  newApi: string;
  oldWww: string;
  newWww: string;
  oldAdmin: string;
  newAdmin: string;
};

export function buildMigrationDomains(
  oldDomain: string,
  newDomain: string,
): MigrationDomains {
  const oldHost = normalizeDomainInput(oldDomain);
  const newHost = normalizeDomainInput(newDomain);
  return {
    oldDomain: oldHost,
    newDomain: newHost,
    oldOrigin: `https://${oldHost}`,
    newOrigin: `https://${newHost}`,
    oldApi: `https://api.${oldHost}`,
    newApi: `https://api.${newHost}`,
    oldWww: `https://www.${oldHost}`,
    newWww: `https://www.${newHost}`,
    oldAdmin: `https://admin.${oldHost}`,
    newAdmin: `https://admin.${newHost}`,
  };
}

export type MigrationDomainValidation = {
  ok: boolean;
  errors: { oldDomain?: string; newDomain?: string };
  domains?: MigrationDomains;
};

export function validateMigrationDomains(
  oldDomainInput: string,
  newDomainInput: string,
): MigrationDomainValidation {
  const oldDomain = normalizeDomainInput(oldDomainInput);
  const newDomain = normalizeDomainInput(newDomainInput);
  const errors: { oldDomain?: string; newDomain?: string } = {};

  const oldError = validateDomainHostname(oldDomain);
  const newError = validateDomainHostname(newDomain);
  if (oldError) errors.oldDomain = oldError;
  if (newError) errors.newDomain = newError;

  if (!oldError && !newError && oldDomain === newDomain) {
    errors.newDomain = "New domain must be different from the old domain.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    domains: buildMigrationDomains(oldDomain, newDomain),
  };
}

export function migrationUrl(
  origin: string,
  path: string,
  search = "",
): string {
  const base = origin.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return search ? `${base}${normalizedPath}?${search}` : `${base}${normalizedPath}`;
}
