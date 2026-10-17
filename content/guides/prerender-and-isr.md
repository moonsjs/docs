---
title: Prerender & ISR
description: Build-time rendering with prerender and paths, incremental revalidation, shared ISR storage, and when to use each mode.
---

A page can be rendered at build time, at request time, or something in between. Prerendering writes complete HTML documents to `dist/client`; ISR keeps those documents and regenerates them in the background after they expire.

## Prerendering a page

Add `export const prerender = true` to a page module; it is rendered once during `moons build` into `dist/client/<path>/index.html`.

```tsx
// src/routes/blog/[slug].tsx
import { useLoaderData, type LoaderArgs } from "@moonsjs/react";

const posts: Record<string, string> = {
  hello: "Hello world",
  kedua: "Second post",
};

export const prerender = true;
export const paths = () => Object.keys(posts).map((slug) => ({ slug }));

export const loader = async ({ params }: LoaderArgs<"/blog/[slug]">) => ({
  title: posts[params.slug],
});

export default function Post() {
  const { title } = useLoaderData<typeof loader>();
  return <h1>{title}</h1>;
}
```

A static route needs no extra export; a dynamic route also needs `paths`, returning an array of param objects. Every route param must be a non-empty string; unknown keys are rejected. Missing `paths` fails with `E_PRERENDER_NO_PATHS`; a malformed list with `E_PRERENDER_INVALID`. For `[...rest]`, pass the whole remainder as one string: `{ rest: "guide/a" }` for `/docs/[...rest]` becomes `/docs/guide/a`. `notFound()` skips a path at build time; `redirect()` fails the build.

The build writes a `_moons_prerender.json` manifest listing each path with its revalidation setting; in a server deployment those paths are served from disk and every other page renders on demand.

## What ends up in the HTML

A prerendered document contains the rendered markup, the client scripts, and the SSR payload inside `<script id="__moons_data" type="application/x-moons">`. The payload carries loader data, params, search params, and metadata, so client navigation works on a static host.

The build request is synthetic — no cookies, no query string — so do not prerender pages whose loaders read `searchParams`.

Prerendering runs the normal pipeline, but the static file keeps only the body: headers set by middleware are not stored, and a middleware redirect fails the build. In production, static files are served before the pipeline, so middleware never runs for them; do not guard prerendered pages with middleware alone.

A leak scan runs in fail mode: if the canary from `vite.config.ts` or a secret-looking environment value appears in a document, the build fails with `E_PRERENDER_LEAK`. A backstop, not a guarantee. When the app has a `_404` page, the build also writes `404.html` for static hosts.

## Incremental revalidation

Add `revalidate` next to `prerender` to make a page expire:

```tsx
// src/routes/pricing.tsx
import { useLoaderData } from "@moonsjs/react";

export const prerender = true;
export const revalidate = 300;

export const loader = async () => ({ checkedAt: new Date().toISOString() });

export default function Pricing() {
  const { checkedAt } = useLoaderData<typeof loader>();
  return <p>{checkedAt}</p>;
}
```

`revalidate` is a number of seconds and requires `prerender = true`; anything else fails the build with `E_ISR_INVALID`. `0` marks the document stale immediately. After expiry, `moons start` serves the current document and regenerates it in the background; the next request gets the new one. Regeneration is atomic, deduplicated per path, replaces the document only on a `200`, and never writes a leak. A static host serves the build-time snapshot forever.

## Shared ISR storage

The default store is the file system, so each instance rewrites its own `dist/client` copy. Configure `isr: { storage }` (`MoonsIsrConfig`) to share state between instances:

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
        "INSERT INTO moons_prerender (path, body, mtime_ms) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET body = excluded.body, mtime_ms = excluded.mtime_ms",
        [pathname, body, Date.now()],
      );
    },
  };
}
```

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";
import { createSqliteStorage } from "./src/shared/isr-storage";

export default defineConfig({
  context: async () => ({}),
  isr: { storage: createSqliteStorage("isr.sqlite") },
});
```

The `read`/`write` pair is the whole interface: `read` returns `{ body, mtimeMs }` or `null`, and `write` stores a new document. Use a shared database, Redis, S3, or an HTTP sidecar across machines. With a store configured, the server reads it first and falls back to `dist/client` on a miss, so assets and non-ISR pages keep working. Warm the store from the build output at deploy time; then one instance's regeneration is visible to every instance.

## Choosing a mode

| Content | Mode |
| --- | --- |
| Same for every visitor, changes rarely | `prerender = true` |
| Same for every visitor, changes on a schedule | `prerender = true` + `revalidate` |
| Depends on cookies, headers, or the visitor | render per request |
| Mutations and fresh reads | `serverFn` or loader at request time |

Never prerender visitor-specific pages: the build request has no cookies and one document is shared by everyone. See [Deployment](/guides/deployment) for serving the output and [Loaders](/core-concepts/loaders) for request-time data.
