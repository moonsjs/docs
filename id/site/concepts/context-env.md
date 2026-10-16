---
description: "context(req) → ctx bertipe lewat typegen, middleware global, env() server-only vs import.meta.env publik."
---

# Context & environment

## `context(req)` — sekali per request

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";

export default defineConfig({
  routesDir: "src/routes",
  context: async (req) => ({ requestId: crypto.randomUUID(), db: myDb }),
});
```

- Dipanggil **sekali per request, sebelum middleware**.
- Hasilnya (`ctx`) tersedia di middleware, loader, dan handler serverFn dengan
  objek yang sama.
- Tipenya global: typegen menulis `.moons/context.d.ts`, sehingga `ctx.db`
  autocomplete di seluruh app.

## `env()` — rahasia, server-only

```ts
import { env } from "@moonsjs/server"; // di dalam *.server.ts

const key = env<string>("API_KEY");
```

- `env()` di modul client = **build gagal** (`E_ENV_IN_CLIENT`).
- Jangan pernah mengembalikan nilai rahasia dari loader atau serverFn `output`.

## Nilai publik

Untuk konfigurasi non-rahasia yang boleh tampil di browser, gunakan Vite:
`import.meta.env.VITE_PUBLIC_FLAG` (di-inline saat build).

## Middleware global

```ts
export default defineConfig({
  routesDir: "src/routes",
  context: async (req) => ({}),
  middleware: [
    async ({ ctx, req, next }) => {
      const started = Date.now();
      const res = await next();
      res.headers.set("x-duration-ms", String(Date.now() - started));
      return res;
    },
  ],
});
```

Middleware membungkus seluruh penanganan (termasuk RPC serverFn) dan cocok untuk
logging, header keamanan, atau short-circuit.
