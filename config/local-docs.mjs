import { existsSync } from "fs";
import { resolve } from "path";
import { repoRoot } from "./load-env.mjs";

/**
 * @param {string | undefined} explicit
 * @param {string} siblingDirName
 */
function resolveLocalDocsPath(explicit, siblingDirName) {
  const trimmed = explicit?.trim();
  if (trimmed) return resolve(trimmed);
  const sibling = resolve(repoRoot, "..", siblingDirName);
  return existsSync(sibling) ? sibling : undefined;
}

/** @returns {string | undefined} */
export function resolveLocalAdminDocsPath() {
  return resolveLocalDocsPath(
    process.env.LOCAL_ADMIN_DOCS_PATH,
    "trustmycard-admin-docs",
  );
}

/** @returns {string | undefined} */
export function resolveLocalApplicationDocsPath() {
  return resolveLocalDocsPath(
    process.env.LOCAL_APPLICATION_DOCS_PATH,
    "trustmycard-application-docs",
  );
}

/** @returns {boolean} */
export function isLocalDocumentationEnabled() {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.VERCEL === "1") return false;
  return Boolean(resolveLocalAdminDocsPath());
}
