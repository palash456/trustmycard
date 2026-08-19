import {
  getProductionBackend,
  isLiveAdminPanel,
  type AdminBackendConfig,
} from "./admin-backend";

/** Production config always targets the production API — never local dev fallback. */
export function getProductionConfigBackend(): AdminBackendConfig | null {
  if (isLiveAdminPanel()) {
    return getProductionBackend();
  }
  return getProductionBackend();
}

export type ProductionConfigApiErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_CONNECTED"
  | "UPSTREAM_ERROR";

export function productionConfigBackendOrError(): {
  backend: AdminBackendConfig;
} | { error: string; code: ProductionConfigApiErrorCode; status: number } {
  const backend = getProductionConfigBackend();
  if (!backend) {
    return {
      error:
        "Production backend is not configured. Set BACKEND_API_URL and ADMIN_API_KEY (deployed admin) or ensure WEBSITE_DOMAIN is available (runtime config) with PRODUCTION_ADMIN_API_KEY (local).",
      code: "NOT_CONFIGURED",
      status: 503,
    };
  }
  if (!backend.apiKey.trim()) {
    return {
      error: `Admin API key is not configured for the ${backend.env} backend.`,
      code: "NOT_CONFIGURED",
      status: 503,
    };
  }
  if (!backend.baseUrl.trim()) {
    return {
      error: "Production API URL is not configured.",
      code: "NOT_CONFIGURED",
      status: 503,
    };
  }
  return { backend };
}
