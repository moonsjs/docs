---
description: "Static prerendering (SSG) with prerender/paths, the fail-closed leak guard, and ISR (revalidate) with stale-while-revalidate."
---

# Prerendering (SSG) & ISR

```tsx
// src/routes/blog/index.tsx — static page
export const prerender = true;

export default function BlogIndex() {
  return <p>blog</p>;
}
```

```tsx
// src/routes/blog/[slug].tsx — dynamic REQUIRES `paths`
export const prerender = true;
export const paths = () => [{ slug: "hello" }, { slug: "kedua" }];

export const loader = async ({ params }: LoaderArgs<"/blog/[slug]">) => ({
  title: posts[params.slug],
});
```

- `prerender: true` is page-only and renders at build time.
- Dynamic route without `paths` → **build fails** (`E_PRERENDER_NO_PATHS`).
- Build-time loader: synthetic `req` (no cookies/auth), `ctx.__prerender === true`
  so loaders can branch. `env()` is allowed — but never return secrets.
- `notFound()` skips the path (runtime 404 stays SSR); `redirect()` at build
  fails (`E_PRERENDER_INVALID`).
- Output: `dist/client/<path>/index.html` + a `_moons_prerender.json` manifest;
  the static server serves only manifested paths (everything else stays SSR).
- Middleware does not run at build time (static files get no middleware headers).

## Zero-trust guard (important)

A payload scan runs in **fail mode** during prerender: if the HTML contains the
`leakTest.canary` or a secret-looking env value (≥12 chars) the build **fails**
with `E_PRERENDER_LEAK` — static leakage is permanent.

## ISR / `revalidate` 

```tsx
export const prerender = true;
export const revalidate = 60; // seconds; 0 = regenerate on every request
```

- When a static file is stale, the server serves it (stale-while-revalidate)
  and regenerates it in the background via in-process SSR.
- Regeneration is **fail-closed**: leaking HTML is never written (old file kept).
- Atomic writes, deduped per path; non-200/redirect never overwrite.
- Invalid value or `revalidate` without `prerender` → `E_ISR_INVALID`.
- Single-instance limitation: use a CDN/reverse proxy or a shared store for
  multi-instance setups; no programmatic invalidation yet.

## Multiple instances

Each instance keeps its own files by default, so regenerations do not
propagate. Configure a shared `isr.storage` (a `PrerenderStorage` with
`read`/`write`) to serve and regenerate pages across instances — see the Vite
reference for the shape.

A store-backed example (SQLite via `bun:sqlite`, single machine):

```ts
// src/shared/isr-storage.ts
import { Database } from "bun:sqlite";
import type { PrerenderStorage } from "@moonsjs/core";

export function createSqliteStorage(file: string): PrerenderStorage {
  const db = new Database(file);
  db.run(
    "CREATE TABLE IF NOT EXISTS moons_prerender (path TEXT PRIMARY KEY, body BLOB NOT NULL, mtime_ms INTEGER NOT NULL)",
  );
  return {
    async read(pathname) {
      const row = db
        .query("SELECT body, mtime_ms FROM moons_prerender WHERE path = ?")
        .get(pathname) as { body: Uint8Array; mtime_ms: number } | null;
      return row === null ? null : { body: new Uint8Array(row.body), mtimeMs: row.mtime_ms };
    },
    async write(pathname, body) {
      db.run(
        "INSERT INTO moons_prerender (path, body, mtime_ms) VALUES (?, ?, ?) " +
          "ON CONFLICT(path) DO UPDATE SET body = excluded.body, mtime_ms = excluded.mtime_ms",
        [pathname, body, Date.now()],
      );
    },
  };
}
```

Wire it in `moons.config.ts` (`isr: { storage: createSqliteStorage("isr.sqlite") }`),
then **warm the store at deploy time**: copy every path from the prerender
manifest (`dist/client/_moons_prerender.json`) into the store before serving.
Instances that share the store read each other's regenerations immediately.
For machines that cannot share a file, implement the same two methods on
Redis/S3/database — the contract (`read` → `{ body, mtimeMs }`, `write`) is the
whole surface.
