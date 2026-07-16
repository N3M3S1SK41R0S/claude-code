/**
 * Lightweight abuse protection for the paid upstream routes (Anthropic,
 * ElevenLabs). Two layers:
 *  - browser cross-site abuse is blocked by an Origin/Host check;
 *  - bursts are throttled by an in-memory token bucket per client IP.
 * The bucket lives per serverless isolate, so it is a mitigation, not a hard
 * global quota — good enough to stop a naive drain loop; put a WAF/KV rate
 * limit in front for stronger guarantees.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 2000;

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function rateLimit(req: Request, route: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `${route}:${clientIp(req)}`;
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

/**
 * Reject browser requests coming from another origin. Requests without an
 * Origin header (curl, server-to-server) are allowed — this guard targets
 * cross-site fetch loops, not direct API use.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
    return originHost === host;
  } catch {
    return false;
  }
}
