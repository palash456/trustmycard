import type { Prisma } from "@prisma/client";

export type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
};

export function parsePagination(query: Record<string, string | undefined>): PaginationParams {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(query.limit ?? "25", 10) || 25)
  );
  return { page, limit, skip: (page - 1) * limit };
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  params: PaginationParams
) {
  return {
    items,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

export function parseSort(
  sort: string | undefined,
  allowed: string[],
  defaultField = "createdAt"
): Record<string, Prisma.SortOrder> {
  const raw = (sort ?? `${defaultField}:desc`).trim();
  const [field, dir] = raw.split(":");
  const key = allowed.includes(field) ? field : defaultField;
  const order: Prisma.SortOrder = dir === "asc" ? "asc" : "desc";
  return { [key]: order };
}
