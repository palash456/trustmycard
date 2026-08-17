export type ActivityFeedSource = "observability" | "tg" | "transfer" | "native";

export type UnifiedActivityItem = {
  id: string;
  source: ActivityFeedSource;
  at: string;
  step: string;
  label: string;
  status: string;
  address: string;
  userId: string | null;
  username: string | null;
  userPublicId: string | null;
  network: string | null;
  error: string | null;
  sessionId: string | null;
  traceId: string | null;
  transactionId: string | null;
  txHash: string | null;
};

export type ActivityFeedResponse = {
  items: UnifiedActivityItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
