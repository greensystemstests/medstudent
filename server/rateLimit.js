/** Small fixed-window rate limiter, per client IP. Enough to stop a runaway client loop. */
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);
    if (!entry || now - entry.start > windowMs) {
      hits.set(req.ip, { start: now, count: 1 });
    } else if (++entry.count > max) {
      return res.status(429).json({ error: 'Too many requests, please wait a minute and try again.' });
    }
    if (hits.size > 10000) hits.clear();
    next();
  };
}
