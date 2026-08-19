export const ADMIN_PROTECTED_SECTIONS = {
  "production-config": {
    prefix: "/settings/production-config",
    label: "Production config",
    passwordEnv: "ADMIN_PRODUCTION_CONFIG_PASSWORD",
  },
  "admin-actions": {
    prefix: "/admin-actions",
    label: "Admin actions",
    passwordEnv: "ADMIN_ACTIONS_PASSWORD",
  },
  documentation: {
    prefix: "/documentation",
    label: "Documentation",
    passwordEnv: "ADMIN_DOCUMENTATION_PASSWORD",
  },
  "developer-test": {
    prefix: "/developer-test",
    label: "Developer test",
    passwordEnv: "ADMIN_DEVELOPER_TEST_PASSWORD",
  },
} as const;

export type AdminProtectedSection = keyof typeof ADMIN_PROTECTED_SECTIONS;

export type AdminProtectedPrefix =
  (typeof ADMIN_PROTECTED_SECTIONS)[AdminProtectedSection]["prefix"];

const SECTIONS_BY_LONGEST_PREFIX = (
  Object.entries(ADMIN_PROTECTED_SECTIONS) as Array<
    [AdminProtectedSection, (typeof ADMIN_PROTECTED_SECTIONS)[AdminProtectedSection]]
  >
).sort((a, b) => b[1].prefix.length - a[1].prefix.length);

export function getAdminProtectedSection(
  pathname: string,
): AdminProtectedSection | null {
  for (const [section, config] of SECTIONS_BY_LONGEST_PREFIX) {
    if (
      pathname === config.prefix ||
      pathname.startsWith(`${config.prefix}/`)
    ) {
      return section;
    }
  }
  return null;
}

export function getAdminProtectedPrefix(
  pathname: string,
): AdminProtectedPrefix | null {
  const section = getAdminProtectedSection(pathname);
  return section ? ADMIN_PROTECTED_SECTIONS[section].prefix : null;
}

export function isAdminProtectedRoute(pathname: string): boolean {
  return getAdminProtectedSection(pathname) !== null;
}

export function getAdminProtectedSectionLabel(
  section: AdminProtectedSection,
): string {
  return ADMIN_PROTECTED_SECTIONS[section].label;
}

export function getAdminProtectedSectionPasswordEnv(
  section: AdminProtectedSection,
): string {
  return ADMIN_PROTECTED_SECTIONS[section].passwordEnv;
}
