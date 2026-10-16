---
description: "Rate limit sebagai middleware global (fixed-window, 429 + retry-after) — bukan fitur core; catatan multi-instance."
---

# Rate limit

Rate limit **bukan fitur core** (tidak ada `security.rateLimit`) — polanya
adalah **middleware global** yang membungkus semua request, termasuk RPC.

## Pola kanonik (cookbook, diuji CI)

```ts
// src/shared/rate-limit.ts — fixed-window in-memory, tanpa dependensi
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

```ts
// moons.config.ts — pasang di rantai middleware global
const rpcLimiter = createRateLimiter({ limit: 30, windowMs: 1_000 });

middleware: [
  async ({ req, next }) => {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/_moons/fn/")) {
      const key = req.headers.get("x-forwarded-for") ?? "local";
      const decision = rpcLimiter(key);
      if (!decision.ok) {
        return new Response("rate limit terlampaui", {
          status: 429,
          headers: { "retry-after": String(Math.ceil(decision.retryAfterMs / 1000)) },
        });
      }
    }
    return next();
  },
],
```

Kode ini hidup dan diuji: [cookbook `moons.config.ts`](https://github.com/moonsjs/cookbook/blob/main/moons.config.ts) ·
[`rate-limit.ts`](https://github.com/moonsjs/cookbook/blob/main/src/shared/rate-limit.ts).

## Catatan produksi

- In-memory hanya benar untuk **satu instance**. Multi-instance / serverless →
  limiter di **reverse proxy** (Cloudflare, nginx, Traefik) atau store bersama
  (Redis) — jangan tambahkan dependensi ke core untuk ini.
- Kunci yang wajar: IP (`x-forwarded-for`) untuk RPC publik, atau identitas
  sesi (`ctx.demoUser`) untuk aksi per-user.
- Selalu sertakan `retry-after`; 429 tanpa header menyulitkan klien yang patuh.

## Untuk agen AI

Resep Inggris: [`docs/ai/recipes/rate-limit.md`](/ai/recipes/rate-limit/) —
memuat kode yang sama dengan tautan ke cookbook (dijaga CI).
