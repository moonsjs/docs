---
title: Context & Environment
description: Create per-request context in moons.config.ts, type it with typegen, and keep secrets in env() while public values use VITE_*.
---

Most apps have per-request state: who is signed in, a request id for logs, a tracing span, a database handle. In Moons you build it in one place — `context(req)` in `moons.config.ts` — and read it as `ctx` everywhere the server runs your code.

## Defining context

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";
import { env, verifyCookie } from "@moonsjs/server";

const sessionSecret = env<string | undefined>("SESSION_SECRET");

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (header === null) return null;
  const prefix = `${name}=`;
  const part = header
    .split(";")
    .map((piece) => piece.trim())
    .find((piece) => piece.startsWith(prefix));
  return part === undefined ? null : part.slice(prefix.length);
}

export default defineConfig({
  routesDir: "src/routes",
  context: async (req) => {
    const token = readCookie(req, "session");
    return {
      requestId: crypto.randomUUID(),
      session:
        sessionSecret === undefined
          ? null
          : await verifyCookie<{ userId: string }>(token, sessionSecret),
    };
  },
});
```

`context` runs once per request, before middleware and before routing, RPC, or API dispatch. The same object is passed down the whole request, so a request id set here appears in every log line that reads `ctx`.

## Where ctx is available

Typegen reads the awaited return type of your `context` function and writes a global `Ctx` type to `.moons/context.d.ts`. The dev server regenerates that file when route files change, and `moons check` regenerates it as its first step, so the types and the config never drift. The scaffold's `tsconfig.json` already includes `.moons/**/*.d.ts`.

With that type in place, `ctx` is typed in all four places server code runs:

| Where | Shape |
| --- | --- |
| Loaders | `LoaderArgs.ctx` |
| [Middleware](/guides/middleware) (global and `_middleware.ts`) | `{ req, ctx, next }` |
| `serverFn` handlers | `{ input, ctx }` |
| `src/api` handlers | `{ req, params, ctx }` |

For example, a loader can guard on the session and pass request data forward:

```tsx
// src/routes/reports.tsx
import { redirect, useLoaderData, type LoaderArgs } from "@moonsjs/react";
import { listReports } from "../server/reports.server";

export const loader = async ({ ctx }: LoaderArgs<"/reports">) => {
  if (ctx.session === null) redirect("/login");
  return { reports: await listReports({ input: {} }) };
};

export default function Reports() {
  const { reports } = useLoaderData<typeof loader>();
  return (
    <ul>
      {reports.map((report) => (
        <li key={report.id}>{report.title}</li>
      ))}
    </ul>
  );
}
```

There is no React hook for `ctx`. Context exists only on the server, so anything the browser needs must travel through loader data or a `serverFn` result — and never as a secret.

## Server secrets with env()

`env<T>(key)` from `@moonsjs/server` reads the process environment (Bun and Node both provide it) and is legal only in server code:

```ts
// src/server/reports.server.ts
import { env, serverFn } from "@moonsjs/server";
import { z } from "zod";

export const listReports = serverFn({
  input: z.object({}),
  output: z.array(z.object({ id: z.string(), title: z.string() })),
  handler: async ({ ctx }) => {
    const apiKey = env<string>("REPORTS_API_KEY");
    const response = await fetch("https://reports.example.com/items", {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    console.log(`listReports (${ctx.requestId})`);
    return (await response.json()) as { id: string; title: string }[];
  },
});
```

Calling `env()` in a module that ends up in the client bundle fails the build with `E_ENV_IN_CLIENT`; there is no flag to turn that off. The generic parameter is a cast, not a check: a missing variable comes back as `undefined` even when you wrote `string`, so validate required secrets explicitly:

```ts
const apiKey = env<string | undefined>("API_KEY");
if (apiKey === undefined) {
  throw new Error("API_KEY is required");
}
```

Public values take the Vite route instead:

```ts
const siteName = import.meta.env.VITE_SITE_NAME;
```

Only variables prefixed with `VITE_` are exposed, and they are inlined into the client bundle at build time — safe for branding, feature flags, and public URLs, never for credentials.

## Request-scoped helpers

Three helpers from `@moonsjs/server` work with the per-request state:

- `cache(fn)` memoizes an async function for the duration of one request. Calls with the same arguments return the same result; outside a request it runs the function without memoizing. Use it inside `*.server.ts` so a layout loader and a page loader that call the same `serverFn` trigger one database round-trip per request.
- `getCurrentContext()` returns the `ctx` of the active request, or `undefined` outside one. It is useful in server helpers that would otherwise take `ctx` as a parameter.
- `runWithContext(ctx, fn)` runs `fn` with a context active. The runtime wraps every request this way; tooling and tests use it to call server code that expects a request context.

```ts
// src/server/posts.server.ts
import { cache, serverFn } from "@moonsjs/server";
import { z } from "zod";
import { db } from "./db.server";

const loadPost = cache(async (slug: string) => {
  // One query per request, even when two loaders ask for the same post.
  return db.post.findUniqueOrThrow({ where: { slug } });
});

export const getPost = serverFn({
  input: z.object({ slug: z.string() }),
  output: z.object({ title: z.string(), body: z.string() }),
  handler: async ({ input }) => loadPost(input.slug),
});
```

## Secrets discipline

Two rules summarize what crosses the boundary. Loader data is embedded in the HTML payload, so it is public; `serverFn` schemas are bundled for client-side validation, so they are public too. Secrets stay inside `env()` behind a `serverFn` handler. [Zero-Trust Model](/core-concepts/zero-trust) explains the enforcement behind those rules.
