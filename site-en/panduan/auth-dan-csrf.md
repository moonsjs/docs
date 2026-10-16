---
description: "Auth via ctx: session cookies HttpOnly/Secure/SameSite, loader & serverFn guards, and the real CSRF limits (RPC only)."
---

# Auth & CSRF

Auth is **not built in** (non-goal). The canonical pattern is small and
explicit: **cookie → `ctx` → guard**.

```ts
// moons.config.ts — raw cookie parsing, no framework helper
function readDemoUser(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (cookie === null) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "demo_user" && rest.length > 0) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export default defineConfig({
  context: async (req) => ({ requestId: crypto.randomUUID(), demoUser: readDemoUser(req) }),
});
```

Live, tested code: [`moons.config.ts`](https://github.com/moonsjs/cookbook/blob/main/moons.config.ts) ·
[`login.tsx`](https://github.com/moonsjs/cookbook/blob/main/src/routes/login.tsx).

## Setting cookies from loaders/serverFns (D.2)

```ts
import { setCookie, setHeader } from "@moonsjs/react"; // or @moonsjs/server

export const loader = async () => {
  setHeader("cache-control", "private, max-age=60");
  setCookie("session_id", token, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 });
  return {};
};
```

- Collected per request and applied to HTML, RPC, API responses and error pages.
- `appendHeader` for multiple values; cookies are auto-encoded; default `Path=/`.
- CRLF/control chars → `E_RESPONSE_HEADER_INVALID`; framing headers rejected;
  outside a request → `E_RESPONSE_OUTSIDE_REQUEST`.

## Guards

- **Loaders**: `if (ctx.demoUser === null) redirect("/login")`.
- **serverFns**: check `ctx` inside the handler; return a schema-safe shape or
 throw your own error (details are masked in production,).

## Session cookie attributes

```txt
Set-Cookie: session=<random-256bit>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...
```

## CSRF limits (important)

- `x-moons: 1` + origin checks (`security.originWhitelist`) protect the **RPC
  endpoints only** (`POST /_moons/fn/*`).
- Loaders are GET and must stay side-effect free; every mutation goes through a
  serverFn. Raw `src/api` endpoints are **not** covered — verify signatures or
  tokens yourself there.
