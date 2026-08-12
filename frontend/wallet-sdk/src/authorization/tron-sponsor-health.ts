import { resolveApiUrl } from "../core/api-url";
import { getErrorMessage } from "../core/errors";

export type TronSponsorHealth = {
  ok: boolean;
  message?: string;
  delegator?: string;
};

export async function fetchTronSponsorHealth(
  apiBaseUrl?: string,
): Promise<TronSponsorHealth> {
  try {
    const res = await fetch(
      resolveApiUrl(apiBaseUrl, "/api/resources/tron-sponsor-health"),
      { cache: "no-store" },
    );
    const json = (await res.json()) as TronSponsorHealth;
    if (!res.ok) {
      return {
        ok: false,
        message:
          json.message ?? `TRON sponsor health check failed (${res.status})`,
      };
    }
    return json;
  } catch (err) {
    return {
      ok: false,
      message: getErrorMessage(err, "TRON sponsor health check unavailable"),
    };
  }
}
