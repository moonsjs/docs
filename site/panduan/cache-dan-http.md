---
description: "cache() per-request untuk dedupe loader, plus header HTTP & caching lewat middleware global."
---

# Panduan: cache request & HTTP headers

## `cache()` — dedupe per request

Loader layout dan page sering membutuhkan data yang sama. `cache()` (dari
`@moonsjs/server`) mengeksekusi fungsi **sekali per request**:

```ts
// src/server/user.server.ts
import { cache } from "@moonsjs/server";

export const getUser = cache(async (id: string) => db.users.find(id));
```

- Key = fungsi + argumen (serialisasi devalue) — `Date`/objek biasa aman.
- Dipanggil di luar request (mis. saat build) → berjalan langsung tanpa memo.
- Tidak ada cache lintas-request: server adalah sumber kebenaran; gunakan
  revalidasi [`refresh()`](/dasar/navigasi/) setelah mutasi.

## Header HTTP & middleware

Untuk caching publik, security headers, atau CORS, pakai middleware global
**atau** helper respons (D.2) di loader/serverFn:

```ts
import { setHeader } from "@moonsjs/react";

export const loader = async () => {
  setHeader("cache-control", "public, max-age=60");
  return { /* data */ };
};
```

```ts
// moons.config.ts
export default defineConfig({
  routesDir: "src/routes",
  context: async () => ({}),
  middleware: [
    async ({ req, next }) => {
      const res = await next();
      const url = new URL(req.url);
      if (url.pathname.startsWith("/assets/")) {
        res.headers.set("cache-control", "public, max-age=31536000, immutable");
      }
      res.headers.set("x-content-type-options", "nosniff");
      return res;
    },
  ],
});
```

- Middleware membungkus **semua** penanganan (HTML + RPC serverFn).
- Untuk halaman dinamis, biarkan tanpa `cache-control` (atau `no-store`).
- Data loader boleh di-cache di sisi CDN/reverse proxy karena SSR bersifat
  deterministik per URL — pastikan tidak ada data per-user di halaman itu.
