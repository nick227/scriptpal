const WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 10;

const requestBuckets = new Map();

const buildKey = (req) => {
  const userKey = req.userId ? `user:${req.userId}` : `ip:${req.ip}`;
  const scriptKey = req.params?.id ? `script:${req.params.id}` : 'script:unknown';
  return `${userKey}:${scriptKey}`;
};

const pruneOldEntries = (timestamps, now) => timestamps.filter(ts => (now - ts) < WINDOW_MS);

const scriptUpdateRateLimit = (req, res, next) => {
  const key = buildKey(req);
  const now = Date.now();
  const existing = requestBuckets.get(key) || [];
  const recent = pruneOldEntries(existing, now);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = recent[0];
    const retryAfterMs = Math.max(0, WINDOW_MS - (now - oldest));
    const retryAfter = Math.ceil(retryAfterMs / 1000);
    return res.status(429).json({
      error: 'Too many script update requests. Please slow down autosave.',
      retryAfter
    });
  }

  recent.push(now);
  requestBuckets.set(key, recent);

  // Opportunistic cleanup to avoid unbounded growth.
  if (requestBuckets.size > 5000) {
    for (const [bucketKey, timestamps] of requestBuckets.entries()) {
      const pruned = pruneOldEntries(timestamps, now);
      if (pruned.length === 0) {
        requestBuckets.delete(bucketKey);
      } else {
        requestBuckets.set(bucketKey, pruned);
      }
    }
  }

  return next();
};

export default scriptUpdateRateLimit;
