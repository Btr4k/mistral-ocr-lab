type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, now = Date.now()) {
  cleanup(now);
  const windowMs = 60_000;
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function resetRateLimiter() {
  buckets.clear();
}

function cleanup(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > 5000) {
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (buckets.size <= 3000) break;
    }
  }
}
