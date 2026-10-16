---
description: "Moons project folder map: routes, server *.server.ts, shared, public, test, components, and the template Dockerfile."
---

# Project structure

```txt
my-app/
├── src/
│   ├── routes/          # file-based routes (pages, layouts, boundaries)
│   ├── server/          # *.server.ts — the only place for secrets
│   ├── shared/          # schemas/modules used by client AND server
│   ├── components/      # client-safe UI components (shadcn/ui pattern)
│   ├── client/main.tsx  # hydration entry (no need to edit)
│   └── styles.css       # Tailwind entry
├── public/              # static assets copied as-is to dist/client
├── test/                # in-process tests (createTestServer)
├── moons.config.ts      # routesDir + context(req) + middleware
├── vite.config.ts       # moons plugin (+ leakTest canary)
├── Dockerfile           # multi-stage container example
└── package.json
```

## Folder rules

- **`src/routes/`** — one file = one route. Allowed exports: page
  `default | loader | meta | prerender | paths | revalidate`; `_layout`
  `default | loader`; `_error`/`_404` only `default`.
- **`src/server/*.server.ts`** — the only place for secrets, `env()`, and
  `node:*`/`bun:*` imports. In the client bundle these files become RPC stubs
  ([details](/concepts/zero-trust/)).
- **`src/shared/`** — schemas/modules used by client **and** server (validation
  schemas, pure helpers, `cn`).
- **`src/components/`** — client-safe UI components (shadcn/ui pattern; see the
  [Tailwind](/ai/recipes/tailwind/) & [shadcn/ui](/ai/recipes/shadcn-ui/) recipes).
- **`public/`** — static assets served without SSR.
- **`test/`** — in-process tests with `createTestServer`
  ([testing guide](/guides/testing/)); run `bun test`.
- **`Dockerfile` / `.dockerignore`** — container deploy example
  ([build & deploy](/guides/deploy/)).
