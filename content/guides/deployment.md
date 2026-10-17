---
title: Deployment
description: Build output, running the production server, static hosting, headers and redirects from config, and Docker.
---

`moons dev` and `moons start` run the same request pipeline — context, middleware,
health, RPC, API routes, and pages go through one handler in both modes. Production
adds the static transport: prerendered documents from `dist/client`, ETag/304, and
gzip for text assets.
Develop on Bun, deploy on Bun or Node: the production host is `Bun.serve` on Bun and
`node:http` on Node, and both run the same pipeline (`MOONS_SERVER` overrides the choice).

A Moons deployment is either a long-running server that serves `dist/client` and renders on demand, or a set of static files for hosts without a runtime. The same build produces both.

## Build output

`moons build` runs three steps: the client build, the server build, and the prerender pass. The result:

- `dist/client` — hashed assets, plus one HTML file per prerendered path (`<path>/index.html`), a `_moons_prerender.json` manifest, and `404.html` when your app has a `_404` page. Configured `headers`, `redirects`, `sitemap`, and `robots` add `_headers`, `_redirects`, `sitemap.xml`, and `robots.txt`.
- `dist/server/index.js` — the server entry that serves `dist/client` and renders everything else.

`moons check` runs typegen, TypeScript checking, both builds, and the prerender pass in one command, so the boundary and the types are verified before you deploy.

## Running the server

`moons start` loads `dist/server/index.js` in-process and sets `NODE_ENV=production` when the shell has not set it. The port comes from `PORT`, defaulting to `3000`.

```bash
PORT=3000 bun run start
```

If you launch `bun dist/server/index.js` yourself, set `NODE_ENV=production` explicitly, as the Docker example below does. Production mode also stops sending error details to clients.

Two endpoints matter to your platform:

- `GET /_moons/health` answers `{"ok":true}` before context and route code, so the probe keeps working even when an app module is broken. `HEAD` is allowed; other methods return `405`.
- `SIGTERM` and `SIGINT` stop new connections, drain in-flight requests (10 seconds by default), and exit with code `0`.

## Environment and proxy settings

Read secrets with `env()` inside server modules; `VITE_*` values are public and baked into the client bundle at build time. Never return environment values from a loader — loader data is embedded in the HTML.

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";

export default defineConfig({
  context: async () => ({}),
  security: {
    trustProxy: true,
    bodyLimitBytes: 2_000_000,
    originWhitelist: ["https://app.example.com"],
  },
});
```

`security.trustProxy` makes the request URL follow `x-forwarded-proto` and `x-forwarded-host`, and makes `getClientIp()` read the first `x-forwarded-for` entry. Enable it only when every request passes through a proxy that overwrites those headers; with the default `false`, forwarded headers are ignored and cannot be spoofed. Either way the server overwrites its internal client-IP header (`CLIENT_IP_HEADER`), so `getClientIp` is safe as a rate-limit key ([Authentication](/guides/authentication)).

`security.bodyLimitBytes` caps RPC bodies (default 1,000,000 bytes). The transport also stops reading any request body above 32 MB; raw API handlers are not covered by the config value, and the body is buffered before the handler runs, so uploads enforce their own limit from the parsed fields ([API Routes](/guides/api-routes)). `requestTimeoutMs` (default 30 seconds) bounds how long a handler may take before the transport answers `504`; set it to `0` only when you accept unbounded requests.

## Static hosting

Everything in `dist/client` can be served by a plain static host, but the host must behave like a web server, not a single-page-app fallback-only setup:

- Serve directory indexes: `/blog/hello` must return `blog/hello/index.html`.
- Serve `404.html` for unknown paths.
- Apply `_headers` and `_redirects` if the platform understands that convention (Cloudflare Pages and Netlify do); otherwise configure the same values in the platform settings.
- Every navigable path needs its own document. Client-side navigation still fetches the target HTML, so paths without a file cannot be reached on a pure static host.

`sitemap.xml` lists only prerendered paths. A page that renders per request belongs on the server deployment.

## Headers, redirects, and sitemap

- `headers` — added to every runtime response unless the response already sets that name; also written to `_headers` for static deploys.
- `redirects` — exact path matches (trailing slash ignored), statuses `301` (default), `302`, `307`, `308`; applied before routes and hooks, and skipped during prerender.
- `sitemap` — `{ site, exclude? }`; only prerendered paths are listed.
- `robots` — `{ sitemap?, disallow? }`; the `Sitemap:` line is added by default when a sitemap is configured.
- `trailingSlash` — `"never"` or `"always"`; answers with a `308` and keeps the method, excluding the root, `/_moons/**`, and asset paths.

The built-in server also caches well with zero configuration: static files get a weak `ETag` and answer `304` on `If-None-Match`, text files over 1 KB are gzipped when the client accepts it, and `/assets/*` gets `Cache-Control: public, max-age=31536000, immutable`. These apply to files from `dist/client`, not to SSR or API responses.

## Docker

The starter template ships a multi-stage Dockerfile; `bun run build` maps to `moons build` in created projects.

```dockerfile
FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.4.2
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["bun", "dist/server/index.js"]
```

```bash
docker build -t my-app .
docker run -p 3000:3000 --env-file .env my-app
```

## Production checklist

- `moons check` passes; fix every failing step instead of skipping it.
- Secrets live in server modules only; the leak canary is set in `vite.config.ts`.
- `NODE_ENV=production` is set for any direct server launch.
- Health checks point at `/_moons/health`; the platform sends `SIGTERM` on deploy.
- `trustProxy` is enabled only behind a proxy that overwrites forwarded headers.
- Public RPC endpoints are rate limited; sessions are guarded ([Authentication](/guides/authentication)).
- Protected pages are not prerendered; see [Prerender & ISR](/guides/prerender-and-isr).
