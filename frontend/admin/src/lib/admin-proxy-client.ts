/** Parse error text from /api/admin/* proxy JSON responses. */
export async function readAdminProxyError(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: string;
      detail?: string;
      message?: string | string[];
    };
    if (body.error) {
      return body.detail ? `${body.error} (${body.detail})` : body.error;
    }
    if (body.message) {
      return Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message;
    }
  } catch {
    // ignore non-JSON bodies
  }
  return fallback;
}
