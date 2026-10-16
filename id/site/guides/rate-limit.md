---
description: "Rate limit sebagai middleware global dengan limiter bawaan @moonsjs/server (sliding window, 429 + retry-after) — bukan fitur core; catatan multi-instance."
---

# Rate limit

Rate limit **bukan fitur core** (tidak ada `security.rateLimit`) — polanya
adalah **middleware global** yang membungkus semua request, termasuk RPC.
`@moonsjs/server` sudah menyediakan limiter-nya; tidak perlu menulis sendiri:

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
          return new Response("rate limit terlampaui", {
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

Kode ini hidup dan diuji: [cookbook `moons.config.ts`](https://github.com/moonsjs/cookbook/blob/main/moons.config.ts).

## Kunci dan keamanan

- **`getClientIp(req)` adalah kunci kanonik.** Ia membaca `x-moons-client-ip`
  yang **selalu ditimpa server** (nilai dari klien dibuang): entri pertama
  `x-forwarded-for` bila `security.trustProxy` aktif, selain itu alamat socket.
  **Jangan pernah memakai `x-forwarded-for` mentah** — header itu dikendalikan
  klien dan bisa diputar sesuka hati.
- `createRateLimiter` in-memory (satu proses). Multi-instance: letakkan limiter
  di **reverse proxy** (Cloudflare/nginx) atau pakai store bersama (Redis);
  tiru kontrak `check(key)` (`ok` / `remaining` / `retryAfterMs`) di store itu.
- Memori dibatasi `maxKeys` (default 10.000): melewatinya, kunci tertua
  dievakuasi (FIFO) — pemutaran kunci oleh penyerang bisa mengusir riwayat
  kunci lain. Pakai kunci tepercaya ber-kardinalitas rendah; untuk trafik
  adversarial, gunakan store bersama.
- Selalu sertakan `retry-after`; 429 tanpa header menyulitkan klien yang patuh.

## Untuk agen AI

Resep Inggris: [rate limit](/ai/recipes/rate-limit/) — memuat kode yang sama
dengan tautan ke cookbook (dijaga CI).
