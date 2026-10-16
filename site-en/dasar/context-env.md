---
description: "context(req) → typed ctx via typegen, global middleware, and env() server-only vs public import.meta.env."
---

# Context & env

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";

export default defineConfig({
  routesDir: "src/routes",
  context: async (req) => ({
    requestId: crypto.randomUUID(),
    url: req.url,
    demoUser: readSessionCookie(req),
  }),
  middleware: [
    async ({ next }) => {
      const res = await next();
      res.headers.set("x-powered-by", "moons");
      return res;
    },
  ],
});
```

- `ctx` is typed from the `context` return value via typegen (`.moons/context.d.ts`);
  it is available in loaders, middleware, serverFns, and `src/api` handlers.
- `context(req)` runs **once per request**, before middleware; plugins may
 extend it.
- Middleware wraps every request (HTML + RPC + API); call `next()` exactly once.

## Environment variables

```ts
// src/server/config.server.ts — server only
import { env } from "@moonsjs/server";
export const apiKey = env<string>("API_KEY");
```

- `env()` is server-only: calling it in a client module fails the build
  (`E_ENV_IN_CLIENT`).
- Public values use Vite: `import.meta.env.VITE_PUBLIC_NAME`.
- Never return `env()` secrets from loaders — payload is embedded in HTML
  (`E_PRERENDER_LEAK` guards prerendered pages, dev scans payloads).
