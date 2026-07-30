export type TgLogBody = {
  type?: string;
  site?: string;
  device?: string;
  ip?: string;
  address?: string;
  error?: unknown;
  location?: string;
  network?: string;
  status?: string;
  userAgent?: string | null;
  event?: string;
  evm?: string | null;
  tron?: string | null;
};

export type EnrichedTgLog = {
  type: string;
  site: string;
  device: string;
  ip: string;
  address: string;
  error: string | null;
  location: string;
  network: string;
  status: string;
};
