---
description: "cache() per-request loader dedupe, plus HTTP headers/caching via response helpers or global middleware."
---

# Caching & HTTP headers

## `cache()` — per-request dedupe

```ts
// src/server/user.server.ts
import { cache } from "@moonsjs/server";

export const getUser = cache(async (id: string) => db.users.find(id));
```

- Key = function + args (devalue serialization) — `Date`/plain objects are safe.
- Outside a request → runs directly, no memo.
- No cross-request cache: the server is the source of truth; revalidate with
  [`refresh()`](/concepts/navigation/) after mutations.

## HTTP headers & caching

Use global middleware **or** the D.2 response helpers:

```ts
import { setHeader } from "@moonsjs/react";

export const loader = async () => {
  setHeader("cache-control", "public, max-age=60");
  return { /* data */ };
};
```

- Middleware wraps everything (HTML + RPC); helpers are request-scoped and also
  apply to error pages.
- Dynamic pages: leave `cache-control` unset (or `no-store`).
- Loader-backed pages may be cached at a CDN/reverse proxy only when they carry
  no per-user data.
