---
description: "Create your first Moons app: moons create → dev → build → start/deploy, including Bun/Node runtime requirements."
---

# Quickstart

## Requirements

Moons runs on Bun ≥ 1.4 (server runtime: Bun or Node). Install Bun from
[bun.sh](https://bun.sh) if needed.

## Create an app

```bash
bunx --package @moonsjs/cli moons create my-app
cd my-app
bun install
```

> `--package` is required because the CLI's binary name (`moons`) differs from
> the package name (`@moonsjs/cli`).

## Develop

```bash
bun run dev        # http://localhost:3000
```

Edit `src/routes/index.tsx`; the dev server reloads instantly.

## Verify & build

```bash
bun run check      # typegen → tsc → build client/server → prerender
bun run build
bun run start      # production server (NODE_ENV=production)
```

## Useful commands

| Command | Purpose |
| --- | --- |
| `bunx moons routes --json` | Actual route table (`--kind=page`) |
| `bunx moons fns --json` | serverFn registry (+ `serverFiles`) |
| `bunx moons errors [--json]` | Error catalog: trigger + suggestions |
| `bunx moons typegen` | Regenerate `.moons/*.d.ts` |
| `bun test` | Template in-process tests (`createTestServer`) |

Next: [project structure](/start/project-structure/) ·
[routing](/concepts/routing/).
