export function extractBearerToken(
  authorization: string | string[] | undefined,
): string {
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  return raw?.startsWith("Bearer ") ? raw.slice(7).trim() : "";
}

export function extractClientSessionId(
  body: Record<string, unknown> | undefined,
): string | undefined {
  if (!body) return undefined;
  for (const key of ["sessionId", "traceId", "clientSessionId"] as const) {
    const value = String(body[key] ?? "").trim();
    if (value) return value;
  }
  return undefined;
}

export function sessionMatchesOwnerNetwork(args: {
  session: { address: string; network: string };
  owner: string;
  network: string;
}): boolean {
  const network = args.network.trim().toLowerCase();
  const owner = args.owner.trim();
  const expected = network === "tron" ? owner : owner.toLowerCase();
  return args.session.network === network && args.session.address === expected;
}
