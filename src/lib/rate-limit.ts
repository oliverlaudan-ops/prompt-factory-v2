/**
 * Tiny in-memory rate limiter, scoped per user-key + route.
 *
 * Why in-memory: zero-deps, works in Next.js without external state.
 * Trade-off: per-process state — in a multi-replica deployment, the
 * effective limit is N×windowLimit. That's acceptable for a self-hosted
 * single-container app; if you scale out, swap this for Redis later.
 *
 * Design: sliding window with a Map<key, number[]> of timestamps. We
 * prune old timestamps on every check — O(N) where N = requests in
 * the current window, which is bounded by `limit` so it's effectively O(1).
 */

type Bucket = number[];

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the oldest request in the window expires. */
  retryAfter: number;
};

export function rateLimit(opts: {
  key: string;
  /** Max requests allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}): RateLimitResult {
  const { key, limit, windowMs } = opts;
  const now = Date.now();
  const cutoff = now - windowMs;

  const bucket = buckets.get(key) ?? [];
  // Prune entries older than the window
  const fresh = bucket.filter((ts) => ts > cutoff);

  if (fresh.length >= limit) {
    const oldest = fresh[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, fresh);
    return { ok: false, remaining: 0, retryAfter };
  }

  fresh.push(now);
  buckets.set(key, fresh);
  return { ok: true, remaining: limit - fresh.length, retryAfter: 0 };
}

/** Test-only — clear all state. */
export function _resetRateLimits() {
  buckets.clear();
}
