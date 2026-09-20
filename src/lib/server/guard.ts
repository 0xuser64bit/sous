/**
 * Shared server-only guards for API routes. Framework-free (no next/*
 * imports) so it stays unit-testable under vitest/node.
 *
 * - `upstreamAuthHeaders()` forwards the optional shared secret to the
 *   sidecar. `.env.example` documents MCP_AUTH_TOKEN; without forwarding
 *   it the variable was dead config.
 * - `clientIp()` extracts a best-effort rate-limit key from headers.
 * - `createRateLimiter()` is a tiny fixed-window throttle. In-memory per
 *   instance: best-effort abuse protection for an open proxy/relay, not a
 *   distributed guarantee — good enough for this MVP's threat model.
 */

export function upstreamAuthHeaders(): Record<string, string> {
  const token = process.env.MCP_AUTH_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function clientIp(req: Pick<Request, "headers">): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "local";
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Fixed-window limiter: `limit` hits per `windowMs` per key.
 * Pass `now` only in tests; production uses Date.now().
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (key: string, now: number = Date.now()): RateLimitResult => {
    const cur = hits.get(key);
    if (!cur || now >= cur.reset) {
      if (hits.size > 2000) {
        for (const [k, v] of hits) if (now >= v.reset) hits.delete(k);
      }
      hits.set(key, { count: 1, reset: now + windowMs });
      return { ok: true };
    }
    if (cur.count < limit) {
      cur.count += 1;
      return { ok: true };
    }
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((cur.reset - now) / 1000)),
    };
  };
}
