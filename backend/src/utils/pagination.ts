/**
 * Pagination Utilities
 * Standard pagination and cursor-based pagination
 */

import { Request } from "express";

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

/**
 * Parse pagination params from request query
 */
export function parsePagination(req: Request, defaultLimit = 20, maxLimit = 100): PaginationParams {
  let page = parseInt(req.query.page as string) || 1;
  let limit = parseInt(req.query.limit as string) || defaultLimit;

  // Enforce bounds
  page = Math.max(1, page);
  limit = Math.min(Math.max(1, limit), maxLimit);

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Create paginated result
 */
export function paginate<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / params.limit);

  return {
    data: items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1
    }
  };
}

/**
 * Apply pagination to an array (in-memory)
 */
export function paginateArray<T>(
  items: T[],
  params: PaginationParams
): PaginatedResult<T> {
  const total = items.length;
  const paginated = items.slice(params.offset, params.offset + params.limit);
  return paginate(paginated, total, params);
}

/**
 * Parse cursor pagination params
 */
export interface CursorParams {
  cursor: string | null;
  limit: number;
}

export function parseCursorPagination(req: Request, defaultLimit = 20, maxLimit = 100): CursorParams {
  const cursor = (req.query.cursor as string) || null;
  let limit = parseInt(req.query.limit as string) || defaultLimit;
  limit = Math.min(Math.max(1, limit), maxLimit);

  return { cursor, limit };
}

/**
 * Create cursor from item ID and timestamp
 */
export function createCursor(id: string, timestamp: string): string {
  return Buffer.from(`${id}:${timestamp}`).toString("base64");
}

/**
 * Parse cursor back to components
 */
export function parseCursor(cursor: string): { id: string; timestamp: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const [id, timestamp] = decoded.split(":");
    if (id && timestamp) {
      return { id, timestamp };
    }
  } catch {
    // Invalid cursor
  }
  return null;
}

/**
 * Apply cursor-based pagination
 */
export function cursorPaginate<T extends { id: string; createdAt?: string }>(
  items: T[],
  params: CursorParams,
  getTimestamp: (item: T) => string = (item) => item.createdAt || ""
): CursorPaginatedResult<T> {
  let filtered = items;

  // If cursor provided, filter items after cursor
  if (params.cursor) {
    const cursorData = parseCursor(params.cursor);
    if (cursorData) {
      const cursorIndex = items.findIndex(
        item => item.id === cursorData.id
      );
      if (cursorIndex >= 0) {
        filtered = items.slice(cursorIndex + 1);
      }
    }
  }

  // Take limit + 1 to check if there are more
  const limited = filtered.slice(0, params.limit + 1);
  const hasMore = limited.length > params.limit;
  const data = hasMore ? limited.slice(0, params.limit) : limited;

  // Create next cursor from last item
  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem
    ? createCursor(lastItem.id, getTimestamp(lastItem))
    : null;

  return {
    data,
    pagination: {
      cursor: params.cursor,
      nextCursor,
      hasMore,
      limit: params.limit
    }
  };
}

/**
 * Express middleware to add pagination to response
 */
export function withPagination(defaultLimit = 20) {
  return (req: Request, res: any, next: () => void) => {
    req.pagination = parsePagination(req, defaultLimit);
    next();
  };
}

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationParams;
    }
  }
}
