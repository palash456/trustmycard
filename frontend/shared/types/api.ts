/**
 * API request/response shapes — keep in sync with backend module DTOs.
 * Add approvals, balances, transfers, wallets contracts here as the API stabilizes.
 */

export type ApiErrorBody = {
  statusCode: number;
  message: string;
  error?: string;
  requestId?: string;
};

export type HealthResponse = {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
};
