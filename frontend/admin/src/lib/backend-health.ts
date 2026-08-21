import {
  backendUnreachableHint,
  describeAdminBackend,
  getDevBackend,
  getProductionBackend,
  type AdminBackendConfig,
} from "./admin-backend";
import { fetchAdminBackend } from "./admin-backend-fetch";
import { getErrorMessage } from "./observability";
import type { LogEnv } from "./log-env-cookie";
import { isLiveAdminPanel } from "./local-dev-policy";

export type BackendHealthResult = {
  env: LogEnv;
  ok: boolean;
  url: string;
  label: string;
  error?: string;
};

const HEALTH_PATH = "/v1/api/settings/public";
const HEALTH_TIMEOUT_MS = 6_000;

export async function probeBackendHealth(
  backend: AdminBackendConfig,
): Promise<BackendHealthResult> {
  const label = describeAdminBackend(backend);
  if (!backend.baseUrl.trim()) {
    return {
      env: backend.env,
      ok: false,
      url: "",
      label,
      error:
        backend.env === "production"
          ? isLiveAdminPanel()
            ? "Production backend URL is not configured. Set WEBSITE_DOMAIN (platform.env or Vercel env) or BACKEND_API_URL as a final fallback."
            : "Production backend URL is not configured. Set WEBSITE_DOMAIN (platform.env or deploy/runtime-config/production.json) or BACKEND_API_URL as a final fallback."
          : "Development backend URL is not configured.",
    };
  }
  if (!backend.apiKey.trim()) {
    return {
      env: backend.env,
      ok: false,
      url: backend.baseUrl,
      label,
      error: `Admin API key is not configured for the ${label}.`,
    };
  }

  try {
    const res = await fetchAdminBackend(`${backend.baseUrl}${HEALTH_PATH}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return {
        env: backend.env,
        ok: false,
        url: backend.baseUrl,
        label,
        error: `HTTP ${res.status} from ${backend.baseUrl}`,
      };
    }
    return { env: backend.env, ok: true, url: backend.baseUrl, label };
  } catch (err) {
    const detail = getErrorMessage(err, "connection failed");
    const hint =
      backend.env === "dev"
        ? " Start the local backend with: cd backend && npm run start:dev"
        : backendUnreachableHint(backend);
    return {
      env: backend.env,
      ok: false,
      url: backend.baseUrl,
      label,
      error: `Cannot reach ${label} at ${backend.baseUrl}.${hint} (${detail})`,
    };
  }
}

export async function probeAllBackendHealth(activeEnv: LogEnv) {
  const productionBackend = getProductionBackend();
  const [dev, production] = await Promise.all([
    probeBackendHealth(getDevBackend()),
    productionBackend
      ? probeBackendHealth(productionBackend)
      : Promise.resolve({
          env: "production" as const,
          ok: false,
          url: "",
          label: "production backend",
          error: isLiveAdminPanel()
            ? "Production backend is not configured. Set WEBSITE_DOMAIN (platform.env or Vercel env) or BACKEND_API_URL as a final fallback, plus ADMIN_API_KEY."
            : "Production backend is not configured. Set WEBSITE_DOMAIN (platform.env or deploy/runtime-config/production.json) or BACKEND_API_URL as a final fallback, plus PRODUCTION_ADMIN_API_KEY.",
        }),
  ]);

  const active = activeEnv === "production" ? production : dev;

  return { activeEnv, dev, production, active };
}
