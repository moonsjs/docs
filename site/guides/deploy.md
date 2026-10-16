---
description: "Production build, NODE_ENV, /_moons/health, the template multi-stage Dockerfile, and the deploy checklist."
---

# Build & deploy

```bash
bun run check     # typegen + tsc + build client/server + prerender
bun run build
NODE_ENV=production bun run start
```

- The build runs the full zero-trust transform + leak test; a leaking canary or
  illegal import fails the build.
- `moons start` sets `NODE_ENV=production` by default (error details are never
 sent to the payload,).
- Static files (`dist/client/**`, including prerendered HTML + the
  `_moons_prerender.json` manifest) win over SSR; anything else falls through
  to the SSR handler. Stale prerendered files revalidate in the background when
  they declare `revalidate` (ISR).
- Health check: `GET /_moons/health` → `{"ok":true}`.

## Docker (provided by the template)

```bash
docker build -t my-app .
docker run -p 3000:3000 --env-file .env my-app
```

- Build stage: `bun install --frozen-lockfile` → `bun run build`.
- Runtime stage: only `package.json`, `node_modules`, `dist`; runs
  `bun dist/server/index.js` with `NODE_ENV=production`.

## Production checklist

- [ ] `bun run check` green (no skipped steps).
- [ ] Secrets only in `*.server.ts` (never in loaders).
- [ ] `leakTest.canary` set in `vite.config.ts`.
- [ ] `context(req)` returns a typed `ctx`; auth guards live in loaders/serverFns.
- [ ] Rate limiting (middleware) on public RPC endpoints.
- [ ] Health check wired to your platform.
- [ ] Graceful shutdown drains (SIGTERM) before exit.
