import { Agent, fetch as undiciFetch } from "undici";

let pinnedAgent: Agent | null = null;

function resolvePinnedBackendIp(): string | null {
  const configured = process.env.BACKEND_API_RESOLVE_IP?.trim();
  return configured || null;
}

function getPinnedAgent(servername: string): Agent {
  if (!pinnedAgent) {
    pinnedAgent = new Agent({
      connect: {
        servername,
      },
    });
  }
  return pinnedAgent;
}

function shouldPinBackendRequest(url: string): { ip: string; hostname: string } | null {
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

  const pinnedUrl = url.replace(`://${pin.hostname}`, `://${pin.ip}`);
  const headers = new Headers(init.headers);
  if (!headers.has("host")) {
    headers.set("host", pin.hostname);
  }

  const undiciInit = {
    ...init,
    headers,
    dispatcher: getPinnedAgent(pin.hostname),
  };

  return undiciFetch(
    pinnedUrl,
    undiciInit as Parameters<typeof undiciFetch>[1],
  ) as unknown as Promise<Response>;
}
