---
description: "Peta folder proyek Moons: routes, server *.server.ts, shared, public, test, dan Dockerfile dari template."
---

# Struktur proyek

```
my-app/
├─ moons.config.ts        # config server-side: routesDir + context(req) + middleware
├─ vite.config.ts         # plugin moons() (+ canary leak test)
├─ index.html             # shell (#root + /src/client/main.tsx)
├─ src/
│  ├─ client/main.tsx     # await hydrate();
│  ├─ routes/             # file routing (lihat Dasar → Routing)
│  └─ server/*.server.ts  # ZONA RAHASIA — tidak pernah sampai ke browser
└─ .moons/                # tipe hasil typegen (gitignored)
```

## Aturan folder

- **`src/routes/`** — satu file = satu route. Export yang diizinkan:
  page `default | loader | meta`; `_layout` `default | loader`;
  `_404`/`_error` hanya `default`.
- **`src/server/*.server.ts`** — satu-satunya tempat untuk rahasia, `env()`,
  dan import `node:*`/`bun:*`. Di bundle client, file ini diganti stub RPC
  ([detail](/keamanan/)).
- **`src/client/main.tsx`** — entry hidrasi. Tidak perlu diubah.
- **`src/shared/`** — schema/modul yang dipakai client **dan** server (mis.
  schema validasi, helper murni, `cn`).
- **`src/components/`** — komponen UI client-safe (pola shadcn/ui; lihat resep
  [Tailwind](/ai/recipes/tailwind/) & [shadcn/ui](/ai/recipes/shadcn-ui/));
  `src/styles.css` = entry Tailwind.
- **`public/`** — aset statis yang disalin apa adanya ke `dist/client`
  (favicon, gambar, robots.txt) dan disajikan tanpa lewat SSR.
- **`test/`** — test in-process dengan `createTestServer`
  ([panduan testing](/panduan/testing/)); jalankan `bun test`.
- **`Dockerfile` / `.dockerignore`** — contoh deploy container
  ([build & deploy](/panduan/deploy/)).

## `moons.config.ts`

```ts
import { defineConfig } from "@moonsjs/core";

export default defineConfig({
  routesDir: "src/routes",
  context: async (req) => ({ requestId: crypto.randomUUID(), db: myDb }),
});
```

Nilai yang dikembalikan `context` menjadi `ctx` — tersedia di middleware,
loader, dan handler serverFn, serta bertipe global lewat `.moons/context.d.ts`
hasil typegen. Lihat [Context & env](/dasar/context-env/).

## Berikutnya

- [Routing](/dasar/routing/)
- [Loader](/dasar/loader/)
- [serverFn](/dasar/server-fn/)
