// Reason: Cursor-based pagination provides better performance and consistency
// than offset-based pagination, especially for large datasets

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
}

interface CursorData {
  id: string;
  createdAt: string;
}

// Reason: Base64 encoding provides URL-safe cursor tokens
function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeCursor(cursor: string): CursorData {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    return JSON.parse(decoded) as CursorData;
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

export function createCursorPagination<
  T extends { id: string; createdAt: Date }
>(items: T[], limit: number): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  let prevCursor: string | null = null;

  if (hasMore && resultItems.length > 0) {
    const lastItem = resultItems[resultItems.length - 1];
    nextCursor = encodeCursor({
      id: lastItem.id,
      createdAt: lastItem.createdAt.toISOString(),
    });
  }

  if (resultItems.length > 0) {
    const firstItem = resultItems[0];
    prevCursor = encodeCursor({
      id: firstItem.id,
      createdAt: firstItem.createdAt.toISOString(),
    });
  }

  return {
    items: resultItems,
    nextCursor,
    prevCursor,
    hasMore,
  };
}

export function buildPaginationQuery(
  cursor?: string,
  limit: number = 20
): {
  take: number;
  cursor?: { id: string };
  orderBy: { createdAt: 'asc' | 'desc' };
} {
  const take = Math.min(Math.max(limit, 1), 100); // Clamp between 1 and 100

  if (!cursor) {
    return {
      take: take + 1, // Fetch one extra to check if there are more
      orderBy: { createdAt: 'desc' },
    };
  }

  const cursorData = decodeCursor(cursor);
  return {
    take: take + 1,
    cursor: { id: cursorData.id },
    orderBy: { createdAt: 'desc' },
  };
}
