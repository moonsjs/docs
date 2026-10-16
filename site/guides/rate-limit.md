---
description: "Rate limiting as global middleware (fixed-window, 429 + retry-after) — not a core feature; multi-instance notes."
---

# Rate limiting

Rate limiting is **not a core feature** — no `security.rateLimit`. Implement it
as global middleware; it wraps HTML and RPC alike.

```ts
// src/shared/rate-limit.ts — fixed-window, no dependencies
export function createRateLimiter(options: { limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (entry === undefined || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return { ok: true, retryAfterMs: 0 };
    }
    if (entry.count >= options.limit) return { ok: false, retryAfterMs: entry.resetAt - now };
    entry.count += 1;
    return { ok: true, retryAfterMs: 0 };
  };
}
```

Wire it in `moons.config.ts` (`middleware`) and return `429` with a
`retry-after` header for `/_moons/fn/*`. Live code:
[cookbook `moons.config.ts`](https://github.com/moonsjs/cookbook/blob/main/moons.config.ts).

Production notes:

- In-memory is correct for a **single instance**; multi-instance/serverless →
  reverse proxy (Cloudflare/nginx) or a shared store (Redis).
- Key by IP (`x-forwarded-for`) for public RPC, or by session identity
  (`ctx.demoUser`) for per-user actions.
