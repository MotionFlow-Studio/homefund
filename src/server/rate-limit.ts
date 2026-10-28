/**
 * Sliding-window rate limiter kept in memory. HomeFund runs as a single
 * Node.js process, so this is enough; counts reset when the server restarts.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  function recent(key: string, now: number) {
    const list = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (list.length === 0) hits.delete(key);
    else hits.set(key, list);
    return list;
  }

  return {
    /** Seconds until the next call is allowed; 0 when it is allowed now. */
    retryAfter(key: string, now = Date.now()): number {
      const list = recent(key, now);
      if (list.length < limit) return 0;
      return Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000));
    },
    /** Counts one call. */
    hit(key: string, now = Date.now()) {
      const list = recent(key, now);
      list.push(now);
      hits.set(key, list);
    },
  };
}
