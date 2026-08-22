import "server-only";

import {
  getDevBackend,
  getProductionBackend,
  type AdminBackendConfig,
} from "./admin-backend";
import { fetchAdminBackend } from "./admin-backend-fetch";
import {
  getLocalDevWebsiteUrl,
  resolveProductionWebsiteUrl,
} from "./admin-env";
import { getErrorMessage } from "./observability";
import { probeWebsiteHealth, type WebsiteHealthResult } from "./website-health";

export const API_HEALTH_PATH = "/v1/api/settings/public";
const HEALTH_TIMEOUT_MS = 6_000;

export type ServiceProbeResult = {
  ok: boolean;
  url: string;
  endpoint: string;
  httpStatus?: number;
  statusText?: string;
  responseTimeMs?: number;
  error?: string;
  checkedAt: string;
};

export type ProductionSystemHealth = {
  checkedAt: string;
  website: WebsiteHealthResult;
  backend: ServiceProbeResult;
  api: ServiceProbeResult;
};

export type SystemHealthScope = "local" | "production";

type BackendProbeContext = {
  scope: SystemHealthScope;
  missingUrlError: string;
  missingKeyError: string;
  unreachableLabel: string;
};

const PROBE_CONTEXT: Record<SystemHealthScope, BackendProbeContext> = {
  local: {
    scope: "local",
    missingUrlError: "Local backend URL is not configured.",
    missingKeyError:
      "Admin API key is not configured for the local backend (ADMIN_API_KEY).",
    unreachableLabel: "local backend",
  },
  production: {
    scope: "production",
    missingUrlError:
      "Production backend URL is not configured. Set WEBSITE_DOMAIN or BACKEND_API_URL.",
    missingKeyError: "Admin API key is not configured for the production backend.",
    unreachableLabel: "production backend",
  },
};

async function probeBackendService(
  backend: AdminBackendConfig | null,
  context: BackendProbeContext,
): Promise<{ backend: ServiceProbeResult; api: ServiceProbeResult }> {
  const checkedAt = new Date().toISOString();

  if (!backend?.baseUrl.trim()) {
    const unavailable: ServiceProbeResult = {
      ok: false,
      url: "",
      endpoint: API_HEALTH_PATH,
      error: context.missingUrlError,
      checkedAt,
    };
    return { backend: unavailable, api: { ...unavailable } };
  }

  if (!backend.apiKey.trim()) {
    const unavailable: ServiceProbeResult = {
      ok: false,
      url: backend.baseUrl,
      endpoint: API_HEALTH_PATH,
      error: context.missingKeyError,
      checkedAt,
    };
    return { backend: unavailable, api: { ...unavailable } };
  }

  const endpoint = `${backend.baseUrl}${API_HEALTH_PATH}`;
  const start = Date.now();

  try {
    const response = await fetchAdminBackend(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    const responseTimeMs = Date.now() - start;
    const result: ServiceProbeResult = {
      ok: response.ok,
      url: backend.baseUrl,
      endpoint,
      httpStatus: response.status,
      statusText: response.statusText,
      responseTimeMs,
      error: response.ok
        ? undefined
        : `HTTP ${response.status} ${response.statusText}`,
      checkedAt,
    };
    return { backend: result, api: { ...result } };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const error = getErrorMessage(err, "connection failed");
    const failed: ServiceProbeResult = {
      ok: false,
      url: backend.baseUrl,
      endpoint,
      responseTimeMs,
      error: `Cannot reach ${context.unreachableLabel} at ${backend.baseUrl}. (${error})`,
      checkedAt,
    };
    return { backend: failed, api: { ...failed } };
  }
}

async function probeSystemHealthForScope(
  scope: SystemHealthScope,
): Promise<ProductionSystemHealth> {
  const context = PROBE_CONTEXT[scope];
  const websiteUrl =
    scope === "local"
      ? getLocalDevWebsiteUrl()
      : resolveProductionWebsiteUrl();
  const backend =
    scope === "local" ? getDevBackend() : getProductionBackend();

  const [website, services] = await Promise.all([
    websiteUrl
      ? probeWebsiteHealth(websiteUrl)
      : Promise.resolve({
          url: "",
          ok: false,
          error:
            scope === "local"
              ? "Local website URL is not configured."
              : "Production website URL is not configured.",
          checkedAt: new Date().toISOString(),
        } satisfies WebsiteHealthResult),
    probeBackendService(backend, context),
  ]);

  return {
    checkedAt: new Date().toISOString(),
    website,
    backend: services.backend,
    api: services.api,
  };
}

export async function probeSystemHealth(
  scope: SystemHealthScope,
): Promise<ProductionSystemHealth> {
  return probeSystemHealthForScope(scope);
}

/** @deprecated Prefer probeSystemHealth("production") */
export async function probeProductionSystemHealth(): Promise<ProductionSystemHealth> {
  return probeSystemHealthForScope("production");
}
