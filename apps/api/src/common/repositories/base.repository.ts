export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export function paginate<T>(data: T[], total: number, page = 1, perPage = 10): PaginatedResult<T> {
  return {
    data,
    meta: {
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage))
    }
  };
}
