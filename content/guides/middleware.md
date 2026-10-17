---
title: Middleware
description: Directory middleware in the routes and API trees, global middleware in config, and the exact request order.
---

Middleware is a request-scoped function that runs before a route or endpoint. It can add headers, check a session, or stop the request entirely, and there are two layers: an optional global chain in `moons.config.ts` and `_middleware.ts` files in the routes and API trees.

## The middleware shape

A directory middleware file is named exactly `_middleware.ts` and default-exports a function. It receives `{ req, ctx, next }` as `MiddlewareArgs` and must return a `Response`.

```ts
// src/routes/dashboard/_middleware.ts
import type { MiddlewareArgs } from "@moonsjs/core";

export default async function dashboardMiddleware({ next }: MiddlewareArgs): Promise<Response> {
  const response = await next();
  response.headers.set("x-dashboard", "1");
  return response;
}
```

The rules are enforced: a middleware must call `next()` exactly once and must return a `Response`. Calling `next()` twice, or returning anything else, produces a server error instead of a confusing page. A file without a default export fails the build with `E_MIDDLEWARE_INVALID`.

To short-circuit, return your own response without calling `next()` — the route never runs. With the session context from [Authentication](/guides/authentication), `ctx.user` is typed and available here:

```ts
// src/routes/admin/_middleware.ts
import type { MiddlewareArgs } from "@moonsjs/core";

export default async function admin({ ctx, next }: MiddlewareArgs): Promise<Response> {
  if (ctx.user === null) {
    return new Response(null, {
      status: 302,
      headers: { location: "/login" },
    });
  }
  return next();
}
```

## Execution order

For a page request the order is:

1. `context(req)` runs once, before any middleware.
2. Global middleware from `moons.config.ts`, in array order.
3. Directory middleware from `_middleware.ts`, root-first along the page's directory chain.
4. The route: loaders, then rendering.

For `src/api`, the same global chain runs first, then API-tree directory middleware root-first, then the method handler. RPC callbacks run the global chain only. A middleware that returns early stops everything after it: no deeper middleware, no loader, no handler. `/_moons/health` answers before context and routing, so the probe keeps working even when your code throws.

## Global middleware

`middleware` in `moons.config.ts` is a validated array of functions, each with the same `{ req, ctx, next }` shape. It wraps every request that reaches the pipeline, including API endpoints and RPC calls. Use it for cross-cutting concerns such as logging, request IDs, and rate limits; use `_middleware.ts` when the rule belongs to one subtree.

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";

export default defineConfig({
  context: async () => ({ requestId: crypto.randomUUID() }),
  middleware: [
    async ({ ctx, next }) => {
      const response = await next();
      response.headers.set("x-request-id", ctx.requestId);
      return response;
    },
  ],
});
```

The API tree has its own `_middleware.ts`. A single file at `src/api/_middleware.ts` guards every endpoint below it, which is where token checks and version headers belong:

```ts
// src/api/_middleware.ts
import { env } from "@moonsjs/server";
import type { MiddlewareArgs } from "@moonsjs/core";

export default async function apiToken({ req, next }: MiddlewareArgs): Promise<Response> {
  const token = req.headers.get("x-api-token") ?? "";
  if (token.length === 0 || token !== env<string>("API_TOKEN")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const response = await next();
  response.headers.set("x-api-version", "1");
  return response;
}
```

For real systems, compare shared secrets in constant time and prefer per-client credentials over one static token.

## Behavior notes

- Middleware runs after `context`, so `ctx` already holds the request state.
- Response helpers such as `setHeader` and `setCookie` also work from middleware; their values are applied to the final response.
- Returning a redirect is just a `Response` with a `location` header and a `3xx` status. There is no special middleware redirect API.
- A violation in directory middleware surfaces as `E_MIDDLEWARE_INVALID`; in global middleware it surfaces as a generic server error. Both mean the same thing: fix the shape.
- Static files are served before the request pipeline in production, so middleware does not run for a prerendered page served from disk. Never rely on middleware as the only guard for content you prerender; keep protected pages on request-time rendering.

See [API Routes](/guides/api-routes) for what handlers receive, and [Authentication](/guides/authentication) for the session guard used above.
