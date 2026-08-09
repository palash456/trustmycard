/** Prefer semantic publicId for routes; fall back to internal CUID. */
export function entityRouteId(record: {
  id: string;
  publicId?: string | null;
}): string {
  return record.publicId?.trim() || record.id;
}

export function entityDisplayId(record: {
  id: string;
  publicId?: string | null;
}): string {
  return record.publicId?.trim() || record.id;
}
