export function pipelineUserPath(address: string): string {
  return `/pipeline/users/${encodeURIComponent(address)}`;
}
