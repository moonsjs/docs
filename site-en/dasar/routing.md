---
description: "File-based routing: static/dynamic/catch-all segments, nested layouts and middleware, and route module export rules."
---

# Routing (file-based)

| File | URL |
| --- | --- |
| `src/routes/index.tsx` | `/` |
| `src/routes/about.tsx` | `/about` |
| `src/routes/users/[id].tsx` | `/users/:id` |
| `src/routes/docs/[...rest].tsx` | `/docs/*` (last segment only) |
| `src/routes/(admin)/panel.tsx` | `/panel` (group, no URL segment) |
| `src/routes/_layout.tsx` | layout for everything below it |
| `src/routes/**/_error.tsx` | nearest error boundary (D.3) |
| `src/routes/_404.tsx` | custom 404 (root only) |
| `src/routes/**/_middleware.ts` | directory middleware |

Export rules are enforced at build time (`E_ROUTE_EXPORT_INVALID`): pages
`default | loader | meta | prerender | paths | revalidate`; layouts
`default | loader`; `_error`/`_404` `default` only.

## Layouts & boundaries

- `_layout.tsx` wraps pages from root→leaf (nesting per folder allowed).
- `_error.tsx` may live in any directory; the **nearest** boundary is used
  (root fallback). Precedence: static > dynamic > catch-all.

## Directory middleware & nested errors 

```ts
// src/routes/admin/_middleware.ts — applies to the whole subtree
import type { MiddlewareArgs } from "@moonsjs/core";

export default async function adminGuard({ ctx, next }: MiddlewareArgs): Promise<Response> {
  if (ctx.demoUser === null) {
    return new Response(null, { status: 302, headers: { location: "/login" } });
  }
  return next();
}
```

- Chain: global `config.middleware` → `_middleware` root→leaf → page.
- RPC `/_moons/fn/*` is **not** wrapped by directory middleware (global + `ctx`
  guards only); `src/api` has its own `_middleware` tree.
- Wrong shape → `E_MIDDLEWARE_INVALID`.

## Raw HTTP endpoints

`src/api/**/*.ts` adds non-page endpoints — see
[API endpoints](/en/panduan/api-routes/).
