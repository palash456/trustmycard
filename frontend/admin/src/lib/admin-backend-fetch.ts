import "server-only";

type PinnedUndici = typeof import("undici");

let pinnedAgent: InstanceType<PinnedUndici["Agent"]> | null = null;
let undiciModule: PinnedUndici | null = null;

function resolvePinnedBackendIp(): string | null {
  const configured = process.env.BACKEND_API_RESOLVE_IP?.trim();
  return configured || null;
}

async function loadUndici(): Promise<PinnedUndici> {
  if (!undiciModule) {
    undiciModule = await import("undici");
  }
  return undiciModule;
}

async function getPinnedAgent(
  Agent: PinnedUndici["Agent"],
  servername: string,
): Promise<InstanceType<PinnedUndici["Agent"]>> {
  if (!pinnedAgent) {
    pinnedAgent = new Agent({
      connect: {
        servername,
      },
    });
  }
  return pinnedAgent;
}

function shouldPinBackendRequest(
  url: string,
): { ip: string; hostname: string } | null {
  const pinnedIp = resolvePinnedBackendIp();
  if (!pinnedIp) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  return { ip: pinnedIp, hostname: parsed.hostname };
}

/** Server-side backend fetch with optional IP pinning for Vercel + nip.io DNS. */
export async function fetchAdminBackend(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const pin = shouldPinBackendRequest(url);
  if (!pin) {
    return fetch(url, init);
  }

  const { Agent, fetch: undiciFetch } = await loadUndici();
  const pinnedUrl = url.replace(`://${pin.hostname}`, `://${pin.ip}`);
  const headers = new Headers(init.headers);
  if (!headers.has("host")) {
    headers.set("host", pin.hostname);
  }

  const dispatcher = await getPinnedAgent(Agent, pin.hostname);
  const undiciInit = {
    ...init,
    headers,
    dispatcher,
  };

  return undiciFetch(
    pinnedUrl,
    undiciInit as Parameters<typeof undiciFetch>[1],
  ) as unknown as Promise<Response>;
}
