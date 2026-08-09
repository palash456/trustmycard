export type ServiceRole = "api" | "worker" | "all";

export function resolveServiceRole(
  env: NodeJS.ProcessEnv = process.env,
): ServiceRole {
  const raw = (env.SERVICE_ROLE ?? "all").trim().toLowerCase();
  if (raw === "api" || raw === "worker") return raw;
  return "all";
}

export function isCollectionSigningEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const explicit = (env.COLLECTION_SIGNING_ENABLED ?? "").trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  const role = resolveServiceRole(env);
  return role === "worker" || role === "all";
}

export function isApiService(env: NodeJS.ProcessEnv = process.env): boolean {
  const role = resolveServiceRole(env);
  return role === "api" || role === "all";
}

export function isWorkerService(env: NodeJS.ProcessEnv = process.env): boolean {
  const role = resolveServiceRole(env);
  return role === "worker" || role === "all";
}
