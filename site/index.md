---
title: Moons
template: splash
description: Zero-trust full-stack TypeScript — server code is replaced by RPC stubs in the client, and any leak fails the build.
head:
  - tag: title
    content: Moons — zero-trust full-stack TypeScript framework
hero:
  title: Moons
  tagline: A full-stack TypeScript framework that makes leaking server code to the client impossible.
  actions:
    - text: Quickstart
      link: /start/quickstart/
      icon: rocket
    - text: Why zero-trust?
      link: /concepts/zero-trust/
      icon: padlock
---

## Highlights

- **[Zero-trust guarantee](/concepts/zero-trust/)** — `*.server.ts` files are replaced by
  RPC stubs in the client bundle; attempts to break through **fail the build**,
  they are not merely "risky".
- **File routing + SSR + React hydration** — `src/routes/index.tsx` → `/`,
  `users/[id].tsx` → `/users/:id`, `[...rest]` for catch-alls.
- **Typed server-side `loader`** — `useLoaderData<typeof loader>()`; rich data
  (`Date`, `Map`, `Set`) crosses server→client via devalue.
- **[serverFn](/concepts/server-fn/) with two-sided validation** — one schema
  (Standard Schema; Zod works) used on both client **and** server.
- **Query params + built-in revalidation** — [`Link search`](/concepts/navigation/),
  `useSearchParams()`, `refresh()` after mutations.
- **AI-first** — agent context pack, `llms.txt`/`llms-full.txt`, CLI JSON
  (`routes|fns|check --json|errors`), and an MCP server.

## Start in 30 seconds

```bash
bunx --package @moonsjs/cli moons create my-app
cd my-app
bun run dev            # http://localhost:3000
```

Then: [project structure](/start/project-structure/) · [routing](/concepts/routing/) ·
[loaders](/concepts/loaders/) · [serverFn](/concepts/server-fn/).

## Examples & reference

- [Cookbook](https://github.com/moonsjs/cookbook) — canonical patterns, tested in CI.
- [API reference](/api/) — `core`, `server`, `react`, `vite`, `cli`, `mcp`.
- [Architecture](/manifest/) — why the server/client boundary is dangerous and
  how Moons enforces it.
