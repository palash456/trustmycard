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
  pin: { ip: string; hostname: string },
): Promise<InstanceType<PinnedUndici["Agent"]>> {
  if (!pinnedAgent) {
    // Keep the request URL on the real hostname; only the TCP/TLS target is pinned.
    // Replacing the hostname in the URL makes Caddy return 200 with an empty body.
    pinnedAgent = new Agent({
      connect: {
        host: pin.ip,
        servername: pin.hostname,
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
  const dispatcher = await getPinnedAgent(Agent, pin);

  return undiciFetch(url, {
    ...init,
    dispatcher,
  } as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
}
