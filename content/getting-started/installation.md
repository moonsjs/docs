---
title: Installation
description: Create a Moons app with the CLI, understand what the scaffold contains, and verify it with a green check run.
---

Moons is a full-stack TypeScript framework where server code is replaced by RPC stubs in the client bundle. This page takes you from an empty directory to a running development server and shows exactly what `moons create` puts in your project.

## Requirements

- **Bun 1.4 or newer.** The toolchain — the CLI, the dev server, and production builds — runs on Bun. Install it from [bun.sh](https://bun.sh) if you do not have it yet.
- **Node.js is supported as a production runtime.** The server output that the build produces runs on Node as well as Bun. You do not need Node for development.

Run `bun --version` to confirm your version before continuing.

## Create a project

```bash
bunx --package @moonsjs/cli moons create my-app
```

`--package` is required because the CLI binary is named `moons` while the package is named `@moonsjs/cli`. Without it, `bunx` looks for a package literally called `moons`.

The command copies the template into `my-app/`, rewrites `package.json` with your project name, and runs `bun install` for you. The target directory must be new or empty — `moons create` refuses to overwrite existing files. The project name is normalized into a package name: lowercase, with unsupported characters replaced by hyphens.

When it finishes, it prints next steps:

```bash
Done! Next steps:
  cd my-app
  moons dev        # dev server (port 3000)
  moons check      # verify: typegen -> tsc -> build
  moons build      # production build (dist/client + dist/server)
  moons start      # serve the build output
```

If `bun install` was skipped (for example because you ran `create` inside another workspace), run it yourself:

```bash
cd my-app
bun install
```

## What the scaffold creates

```bash
my-app/
|-- index.html                 # HTML shell; loads src/client/main.tsx
|-- src/
|   |-- client/
|   |   `-- main.tsx           # hydration entry (calls hydrate())
|   |-- routes/                # one file = one route
|   |   |-- _layout.tsx        # layout that wraps every page
|   |   |-- index.tsx          # /
|   |   |-- about.tsx          # /about
|   |   |-- docs/[...rest].tsx # /docs/*
|   |   `-- users/
|   |       |-- index.tsx      # /users
|   |       `-- [id].tsx       # /users/:id
|-- test/example.test.ts       # in-process request tests
|-- Dockerfile                 # multi-stage container example
|-- moons.config.ts            # routesDir + context(req) + middleware
|-- vite.config.ts             # the moons() plugin + leak canary
|-- tsconfig.json
`-- package.json
```

Two directory names are conventions that you create when you first need them:

- **`src/server/`** — the home of `*.server.ts` files: server-only modules with secrets, database clients, and `serverFn` declarations.
- **`src/api/`** — the home of raw HTTP endpoints. `src/api/hello.ts` becomes `/api/hello`; use it for webhooks, uploads, and other non-RPC traffic.

The generated `package.json` exposes a small set of scripts:

```bash
{
  "scripts": {
    "dev": "moons dev",
    "build": "moons build",
    "start": "moons start",
    "check": "moons check",
    "tsc": "tsc"
  }
}
```

The `moons` command resolves to the local CLI that the scaffold added as a dev dependency, so every script keeps working after a fresh checkout and `bun install`.

## Start the dev server

```bash
bun run dev
```

Open http://localhost:3000. The routes shown above are already live: `/` renders the home page, `/about` renders the about page, and `/users/u1` demonstrates dynamic params. Edit `src/routes/index.tsx` and the page updates instantly — no manual restart.

## Verify with `moons check`

`bun run check` runs the full verification pipeline in order:

1. **typegen** — regenerates `.moons/*.d.ts` (typed routes and `ctx`).
2. **TypeScript checking** — runs `tsc --noEmit` with the project's own compiler settings.
3. **client build** — the browser bundle, including the zero-trust transform and the leak canary check.
4. **server build** — the SSR and server bundle.
5. **prerender** — renders static routes, if the app declares any.

A green run ends with:

```bash
[moons] check OK — typegen + tsc + build client/server + prerender passed
```

Exit code `0` means every step passed. On failure, the failing step and its output are printed and the chain stops with a non-zero exit code. Run this after every meaningful change; it is the fastest complete answer to "is my app still sound?".

## Next steps

Continue with [Your First App](/getting-started/first-app) to add routes and your first server function, or read [Zero-Trust Model](/core-concepts/zero-trust) first to understand what the build is protecting.
