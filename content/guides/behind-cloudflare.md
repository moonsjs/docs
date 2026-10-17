---
title: Behind Cloudflare
description: Run the Moons server behind the Cloudflare proxy: trusted client IPs, origin lockdown, caching, rate limits, and Turnstile.
---

Cloudflare can sit in front of a Moons app as a reverse proxy: visitors hit Cloudflare, Cloudflare forwards to your origin, and your origin is the same `moons start` process on Bun or Node. Moons does not run inside Workers — the server always executes on your machine (that is a deliberate limit, not a missing adapter). What changes behind the proxy is how you read the client IP, how you lock the origin down, and which Cloudflare features complement the framework defaults.

## Trust the right client IP

Cloudflare appends to `x-forwarded-for` instead of replacing it: if a client sends `x-forwarded-for: 6.6.6.6`, that value stays in front and Cloudflare's own value is added behind it. The authoritative header is `cf-connecting-ip`, and Cloudflare's own guidance is to read that header rather than `x-forwarded-for`.

Moons reflects this with `security.clientIpHeader`:

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";

export default defineConfig({
  routesDir: "src/routes",
  security: {
    trustProxy: true,
    clientIpHeader: "cf-connecting-ip",
  },
});
```

- `trustProxy: true` makes the request URL follow `x-forwarded-proto` (Cloudflare overwrites it with the visitor's protocol) and enables trusted client-IP resolution.
- `clientIpHeader: "cf-connecting-ip"` makes `getClientIp()` read only that header; a spoofed `x-forwarded-for` is ignored, and if the header is missing or not a plausible IP, the socket address is used instead.
- `clientIpHeader` without `trustProxy: true` fails the build with `E_CONFIG_INVALID` — a header that is never read would be a false sense of security.

`getClientIp(req)` is what `createRateLimiter` and your own audit logs should use; see [Authentication](/guides/authentication).

## Lock the origin down

With the proxy in place, the origin should accept traffic only from Cloudflare:

- **Authenticated Origin Pulls** — Cloudflare presents a client certificate to your origin; configure your TLS terminator to require it. This proves the connection came from Cloudflare.
- **Cloudflare Tunnel** — run `cloudflared` next to the app and let it dial out; the origin needs no public port at all.
- **Firewall** — restrict the origin port to [Cloudflare's IP ranges](https://www.cloudflare.com/ips/).

Without one of these, anyone who learns the origin address can bypass the proxy and send their own `x-forwarded-*` headers. `trustProxy: true` is only safe when every request really passes through Cloudflare.

## What keeps working unchanged

- **RPC origin checks.** `serverFn` calls still require the `x-moons: 1` header and a matching `Origin`; the URL reconstruction behind the proxy is what makes the comparison correct, and it is covered by the framework's [hardening tests](https://github.com/moonsjs/Moons/blob/main/quality/e2e/hardening/transport.sh).
- **Security headers and the leak canary.** `config.headers` and the default headers apply on every response, proxied or not.
- **ISR storage.** `isr.storage` is your origin-side store; Cloudflare never sees it.

## Caching

Static assets under `/assets/*` already carry `Cache-Control: public, max-age=31536000, immutable`, so Cloudflare caches them by default. Two things need care:

- **SSR HTML is not cached by Cloudflare unless you ask.** Use a Cache Rule for the paths you want at the edge. If the page is ISR-managed, keep the edge TTL shorter than `revalidate`, or the edge will keep serving the old copy after your origin regenerated it.
- **Cache by response headers when you need finer control.** An origin can send `CDN-Cache-Control` (or `Cloudflare-CDN-Cache-Control` for Cloudflare only) next to `Cache-Control` to give the edge a different TTL than browsers, and `stale-while-revalidate` / `stale-if-error` to serve stale copies during regeneration or outages. Moons applies your global `headers` config to every response today; per-route cache policy is a tracked candidate, so for now route-specific rules live in Cloudflare Cache Rules.

## Rate limits and bot protection

The in-process `createRateLimiter` is the canonical limit and now keys on the correct client IP (`cf-connecting-ip`). Add Cloudflare's WAF **rate limiting rules** on the same routes as an outer layer: they stop abusive traffic before it reaches your origin, and they keep working during deploys.

For public forms and unauthenticated endpoints, [Turnstile](https://developers.cloudflare.com/turnstile/) adds a challenge without cookies. Verify the token on the server:

```ts
// src/server/turnstile.server.ts
import { env } from "@moonsjs/server";

export async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = env("TURNSTILE_SECRET_KEY");
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (ip !== null) {
    body.set("remoteip", ip);
  }
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
```

Call it from the API route or `serverFn` that handles the submission, using `getClientIp(req)` for the `remoteip` hint. Turnstile replaces bot guessing, not authorization: keep your own checks (see [Authentication](/guides/authentication)).

## Staging and previews

`cloudflared tunnel --url http://localhost:3000` gives a staging URL for a `moons dev` or `moons start` instance with real TLS, which is the cheapest way to exercise `trustProxy` before production. For long-lived previews, put Cloudflare Access in front so only your team can reach them.

## Checklist

- `security.trustProxy: true` and `security.clientIpHeader: "cf-connecting-ip"`.
- Origin reachable only through Cloudflare (Authenticated Origin Pulls, Tunnel, or firewall).
- `/assets/*` cached immutable; SSR/ISR paths have a Cache Rule with an edge TTL shorter than `revalidate`.
- WAF rate limiting rules on login/API/form routes; `createRateLimiter` still in place.
- Turnstile verified server-side for public forms.
- `moons check` and `moons audit` green in CI.

See [Deployment](/guides/deployment) for the general production checklist and [Authentication](/guides/authentication) for rate limiting and cookies.
