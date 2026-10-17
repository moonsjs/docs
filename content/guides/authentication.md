---
title: Authentication
description: A session pattern built on context, signed cookies, loader and serverFn guards, and rate limiting.
---

Moons has no built-in user store or login flow. The intended pattern is small: read a signed session cookie once per request, expose the user on `ctx`, and guard every loader and server function that needs it.

## The session pattern

`context(req)` runs once per request, before middleware and routes. Parse the cookie header, verify the signature with a server secret, and return the session shape on `ctx`. Typegen turns that return value into the global `Ctx` type that loaders and server functions see.

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";
import { env, verifyCookie } from "@moonsjs/server";

type Session = { userId: string };

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (header === null) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name && rest.length > 0) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export default defineConfig({
  context: async (req) => {
    const token = readCookie(req, "session");
    const session = await verifyCookie<Session>(
      token,
      env<string>("SESSION_SECRET"),
    );
    return { requestId: crypto.randomUUID(), user: session?.userId ?? null };
  },
});
```

`verifyCookie` returns `null` for a missing, tampered, or expired token, so the app handles "signed in" or "not signed in". Keep a long random `SESSION_SECRET`; signing rejects secrets shorter than 16 characters.

## Issuing and clearing the cookie

Sign the session in a `serverFn` and set it with `setCookie`. `expiresIn` is the token lifetime in seconds and `maxAge` is the cookie lifetime; give them the same value.

```ts
// src/server/session.server.ts
import { deleteCookie, env, serverFn, setCookie, signCookie } from "@moonsjs/server";
import { z } from "zod";

const secret = env<string>("SESSION_SECRET");
const WEEK = 60 * 60 * 24 * 7;

export const login = serverFn({
  input: z.object({ userId: z.string().min(1) }),
  output: z.object({ ok: z.boolean() }),
  handler: async ({ input }) => {
    // Check the credentials against your own user store first.
    const token = await signCookie({ userId: input.userId }, secret, {
      expiresIn: WEEK,
    });
    setCookie("session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: WEEK,
    });
    return { ok: true };
  },
});

export const logout = serverFn({
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  handler: async () => {
    deleteCookie("session", { path: "/" });
    return { ok: true };
  },
});
```

The cookie is signed, not encrypted: anyone can decode the payload. Keep only identifiers and claims in it, never secrets. `httpOnly` keeps scripts from reading it, `secure` keeps it off plain HTTP, and `sameSite: "lax"` limits cross-site requests.

## Guarding loaders and server functions

A loader can stop a page with `redirect()`:

```tsx
// src/routes/dashboard.tsx
import { redirect, useLoaderData, type LoaderArgs } from "@moonsjs/react";

export const loader = async ({ ctx }: LoaderArgs<"/dashboard">) => {
  if (ctx.user === null) redirect("/login");
  return { userId: ctx.user };
};

export default function Dashboard() {
  const { userId } = useLoaderData<typeof loader>();
  return <p>Signed in as {userId}</p>;
}
```

A server function must check the same thing in its handler; the browser can call it directly:

```ts
// src/server/account.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";

export const renameAccount = serverFn({
  input: z.object({ name: z.string().min(1).max(80) }),
  output: z.object({ name: z.string() }),
  handler: async ({ input, ctx }) => {
    if (ctx.user === null) {
      throw new Error("Not signed in");
    }
    return { name: `${ctx.user}:${input.name}` };
  },
});
```

A thrown error becomes a generic failure; production responses omit the message. If you want a displayable result, return a schema-safe flag instead.

## CSRF and origin protection

RPC calls check a header and an origin. `POST /_moons/fn/<hash>` requires `x-moons: 1`; when a browser sends an `Origin` header, Moons accepts it only if it matches the request host or an origin listed in `security.originWhitelist`, for example `originWhitelist: ["https://app.example.com"]`. A mismatch returns `403` with `E_RPC_BAD_ORIGIN`.

It is forgery protection, not authorization. Raw `src/api` endpoints are outside it, so verify signatures or tokens there yourself ([API Routes](/guides/api-routes)). Behind a TLS-terminating proxy, set `security.trustProxy: true` so the origin check sees the public protocol and host; enable it only behind a proxy that overwrites them.

## Brute-force protection

`createRateLimiter` is a sliding-window, in-memory limiter. Key it by the trusted client IP: `getClientIp(req)` reads the value the server itself wrote.

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";
import { createRateLimiter, getClientIp } from "@moonsjs/server";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export default defineConfig({
  context: async () => ({ requestId: crypto.randomUUID() }),
  middleware: [
    async ({ req, next }) => {
      if (new URL(req.url).pathname.startsWith("/_moons/fn/")) {
        const hit = limiter.check(getClientIp(req) ?? "unknown");
        if (!hit.ok) {
          return new Response("Too many requests", {
            status: 429,
            headers: {
              "retry-after": String(Math.ceil(hit.retryAfterMs / 1000)),
            },
          });
        }
      }
      return next();
    },
  ],
});
```

Call `reset(key)` after a successful login to clear that history. The limiter is per process; with several instances, use a shared counter or limit at the proxy.

## What is not included

There is no user table, password hashing, email verification, OAuth client, or session revocation list. Sessions are stateless: to revoke every session, rotate `SESSION_SECRET`. You compose rate limiting and cookie flags; the framework supplies context, cookie signing, and the boundary.

See [Middleware](/guides/middleware) for request-level details and [Protected Route](/recipes/protected-route) for a full example.
