---
description: "Rate limiting as global middleware with the built-in @moonsjs/server limiter (sliding window, 429 + retry-after) — not a core feature; multi-instance notes."
---

# Rate limiting

Rate limiting is **not a core feature** — no `security.rateLimit`. Implement it
as global middleware; it wraps HTML and RPC alike. `@moonsjs/server` ships the
limiter so apps do not hand-roll one:

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";
import { createRateLimiter, getClientIp } from "@moonsjs/server";

const rpcLimiter = createRateLimiter({ limit: 30, windowMs: 1_000 });

export default defineConfig({
  context: async (req) => ({}),
  middleware: [
    async ({ req, next }) => {
      if (new URL(req.url).pathname.startsWith("/_moons/fn/")) {
        const decision = rpcLimiter.check(getClientIp(req) ?? "unknown");
        if (!decision.ok) {
          return new Response("rate limit exceeded", {
            status: 429,
            headers: {
              "retry-after": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1_000))),
            },
          });
        }
      }
      return next();
    },
  ],
});
```

Live code: [cookbook `moons.config.ts`](https://github.com/moonsjs/cookbook/blob/main/moons.config.ts).

Keys and security:

- **`getClientIp(req)` is the canonical key.** It reads `x-moons-client-ip`,
  which the server *always* overwrites (client-provided values are discarded):
  the first `x-forwarded-for` entry when `security.trustProxy` is enabled,
  otherwise the socket address. **Never key on raw `x-forwarded-for`** — it is
  client-controlled and can simply be rotated.
- `createRateLimiter` is in-memory (one process). For multiple instances, put
  the limiter at the reverse proxy (Cloudflare/nginx) or use a shared store
  (Redis); reproduce the `check(key)` contract (`ok` / `remaining` /
  `retryAfterMs`) in the store.
- Memory is bounded by `maxKeys` (default 10,000): beyond it the oldest key is
  evicted (FIFO), so adversarial key rotation can evict other keys' history.
  Key on a trusted, low-cardinality value, and use a shared store under attack.
- Always send `retry-after` on 429.

## For AI agents

English recipe: [rate limit](/ai/recipes/rate-limit/) — same code, linked to the
cookbook (CI-guarded).
