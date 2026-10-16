# Security model — zero-trust

Moons' promise is simple: server code cannot leak to the client — and any
attempt **fails the build**.

## What may cross the boundary

| Public (may enter the browser) | Private (server only) |
| --- | --- |
| All `src/routes/**`, `src/client/**`, `src/shared/**` files | Contents of `src/server/*.server.ts` |
| **Loader data** (embedded into the HTML!) | `env()`, credentials, DB access |
| `import.meta.env.VITE_*` values | `ctx` (server-side context) |

> The most common mistake: believing loaders are "safe". Loader data shows up in
> the HTML payload — never return secrets from a loader.

## Server-only packages 

Importing a server-only npm package from a client module **fails the build**
(`E_FORBIDDEN_SERVER_IMPORT`):

- **Built-in list** (examples): `pg`, `postgres`, `mysql2`, `better-sqlite3`,
  `drizzle-orm`, `@prisma/client`, `prisma`, `mongodb`, `mongoose`, `redis`,
  `bcrypt`, `jsonwebtoken`, `nodemailer`, `sharp`, `dotenv`, `knex`, `typeorm`,
  `sequelize`, … — full list in the [core reference](/api/core/); the built-in
  list cannot be removed by apps.
- **`security.serverOnlyPackages`** — app-specific additions.
- **Package marker** — a dependency's `package.json` may declare
  `{ "moons": { "serverOnly": true } }` (workspace/mirror packages).
- Matching uses the **resolved package name**: subpaths
  (`@prisma/client/runtime`), Vite aliases, `tsconfig paths`, and
  symlinks/workspaces are all caught.
- Valid way out: move the import into `*.server.ts` and call it through a
  `serverFn`, or use a **type-only** import (`import type ...`).

## Safe patterns

- Secrets live **only** inside `serverFn` handlers; only schema-validated
  `output` leaves the server.
- For credential-dependent page work: create a dedicated `serverFn` (e.g. call a
  third-party API from the server) — never export the key.
- Inspect the server-only file list any time: `bunx moons fns --json`
  (`serverFiles` field).
- Verify: `bunx moons check` — typegen + tsc + client/server build + prerender.
- **Dev**: the SSR payload is scanned automatically — a console warning appears
  if it contains the `leakTest.canary` or a secret-looking env value (≥12
  chars). This is an early signal, not a guarantee; production never scans.

## For AI agents

The boundary is designed so agents cannot "patch around" it dangerously: the
full context pack lives at [Agent context](/ai/context/) and ships offline in
`node_modules/@moonsjs/cli/docs/ai/CONTEXT.md`.
