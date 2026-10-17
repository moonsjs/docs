---
title: Protected Route
description: Read a signed session cookie in context, guard a page loader, and issue or clear the session with server functions.
---

This recipe protects a dashboard with a signed cookie. The request context verifies the cookie once, the loader stops unauthenticated visitors, and two server functions manage the session. Moons supplies the signing helpers; the user store and credential check are yours.

## What we are building

- `moons.config.ts` parses the cookie and verifies it with `verifyCookie`.
- `src/server/auth.server.ts` contains `login` and `logout`.
- `src/routes/login.tsx` submits an email and shows an error.
- `src/routes/dashboard.tsx` redirects when `ctx.user` is `null`.
- `src/routes/admin/_middleware.ts` shows the directory-wide alternative.

## The request context

`context(req)` runs once per request, before middleware and routes. Parsing and verifying the cookie there means every loader and server function sees the same `ctx.user`.

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";
import { env, verifyCookie } from "@moonsjs/server";

type Session = { userId: string };

const secret = env<string | undefined>("SESSION_SECRET");

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (header === null) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name && rest.length > 0) return rest.join("=");
  }
  return null;
}

export default defineConfig({
  routesDir: "src/routes",
  context: async (req) => {
    const token = readCookie(req, "session");
    const session =
      token === null || secret === undefined || secret.length < 16
        ? null
        : await verifyCookie<Session>(token, secret);
    const user =
      session !== null && typeof session.userId === "string" ? session.userId : null;
    return { requestId: crypto.randomUUID(), user };
  },
});
```

`verifyCookie` returns `null` for a missing, tampered, or expired token, so `user` is either a string or `null`. The length guard fails closed when `SESSION_SECRET` is missing or too short; `signCookie` rejects it at login.

## Issuing and clearing the session

```ts
// src/server/auth.server.ts
import { deleteCookie, env, serverFn, setCookie, signCookie } from "@moonsjs/server";
import { z } from "zod";

const secret = env<string>("SESSION_SECRET");
const WEEK = 60 * 60 * 24 * 7;

export const login = serverFn({
  input: z.object({ email: z.email() }),
  output: z.object({ ok: z.boolean() }),
  handler: async ({ input }) => {
    // No user store in this recipe: replace this comment with a credential
    // check against your own store before issuing the cookie.
    const token = await signCookie({ userId: input.email }, secret, {
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

`expiresIn` is the token lifetime in seconds; `maxAge` is the cookie lifetime. Keep them equal. The cookie is signed, not encrypted: anyone can decode the payload, so store only an identifier. `httpOnly` blocks scripts, `secure` requires HTTPS, and `sameSite: "lax"` limits cross-site sends.

## The login page

```tsx
// src/routes/login.tsx
import { useState } from "react";
import { login } from "../server/auth.server";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setError(null);
    if (email.trim().length === 0) {
      setError("Enter your email.");
      return;
    }

    setSubmitting(true);
    try {
      await login({ input: { email: email.trim() } });
      window.location.assign("/dashboard");
    } catch {
      setError("Could not sign in. Check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          required
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {error !== null ? <p role="alert">{error}</p> : null}
    </main>
  );
}
```

## Guarding the page

```tsx
// src/routes/dashboard.tsx
import { redirect, useLoaderData, type LoaderArgs } from "@moonsjs/react";
import { useState } from "react";
import { logout } from "../server/auth.server";

export const loader = async ({ ctx }: LoaderArgs<"/dashboard">) => {
  if (ctx.user === null) redirect("/login", 303);
  return { user: ctx.user };
};

export default function Dashboard() {
  const { user } = useLoaderData<typeof loader>();
  const [error, setError] = useState<string | null>(null);

  async function signOut(): Promise<void> {
    try {
      await logout({ input: {} });
      window.location.assign("/login");
    } catch {
      setError("Could not sign out. Try again.");
    }
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as {user}</p>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
      {error !== null ? <p role="alert">{error}</p> : null}
    </main>
  );
}
```

## Directory middleware instead

If a whole directory is protected, a `_middleware.ts` can stop the request before any loader runs. It reads the verified `ctx.user`; it does not parse the cookie again.

```ts
// src/routes/admin/_middleware.ts
import type { MiddlewareArgs } from "@moonsjs/core";

export default async function adminGate({ ctx, next }: MiddlewareArgs): Promise<Response> {
  if (ctx.user === null) {
    return new Response(null, {
      status: 303,
      headers: { location: "/login" },
    });
  }
  return next();
}
```

Page middleware runs for pages under `src/routes/admin/`, not for RPC calls or `src/api`. A `serverFn` must still check `ctx.user` in its handler, because the browser can call it directly.

## How it works

`context(req)` verifies the cookie once and puts `user` on `ctx`. The dashboard loader checks `ctx.user` before rendering; when it is null, `redirect("/login", 303)` stops the page. A 303 is supported and follows with a GET.

`login` signs the user id and sets an HttpOnly cookie. The navigation to `/dashboard` sends the cookie back, so the loader runs with a string. `logout` deletes the cookie, and the next navigation lands on `/login` as a signed-out request.

## Limits and next steps

There is no user store here: `login` accepts any valid email as the user id. Replace that with a password hash check. Moons signs and verifies the cookie but does not store sessions; logout only clears the browser cookie, and a copied cookie stays valid until it expires. Rotating `SESSION_SECRET` invalidates every session at once.

RPC calls require `x-moons: 1` and check the request `Origin`, but that is forgery protection, not authorization. Add a CSRF token for sensitive mutations, and rate-limit login attempts with `createRateLimiter` and `getClientIp`. Set `SESSION_SECRET` to a random value of at least 16 characters; signing rejects shorter secrets. See [Authentication](/guides/authentication) for cookie flags and rate limiting, and [Middleware](/guides/middleware) for request order.
