/** True only for local `next dev` when external admin docs are configured. */
export function isLocalDocumentationEnabled(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  return process.env.NEXT_PUBLIC_LOCAL_ADMIN_DOCS === "1";
}
