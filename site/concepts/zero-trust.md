# Security model — zero-trust

Moons' promise is simple: server code cannot leak to the client — and any
attempt **fails the build**.

## What may cross the boundary

| Public (may enter the browser) | Private (server only) |
| --- | --- |
| All `src/routes/**`, `src/client/**`, `src/shared/**` files | Contents of `src/server/*.server.ts` |
| **Loader data** (embedded into the HTML!) | `env()`, credentials, DB access |
| `import.meta.env.VITE_*` values | `ctx` (server-side context) |
| **`serverFn` schemas** (`input`/`output` expressions) | Values only referenced by a schema — rejected at build (`E_SCHEMA_*`) |

> The most common mistake: believing loaders are "safe". Loader data shows up in
> the HTML payload — never return secrets from a loader.

Two contracts worth stating plainly:

- **Schemas are public.** The client keeps each `serverFn` `input`/`output`
  schema for two-sided validation, so every literal and message inside a schema
  ships to the browser. Never put secrets in a schema — validate them in the
  handler instead. Referencing a local declaration, or a value imported from
  another `.server.ts`, inside a schema fails the build
  (`E_SCHEMA_LOCAL_REF` / `E_SCHEMA_SERVER_REF`).
- **`src/server/**` and `moons.config.ts` are server-only.** Importing values
  from them in a client module fails the build (`E_FORBIDDEN_SERVER_IMPORT`).
  `import type` is always allowed — types are erased at compile time, including
  `import type` from `*.server.ts`.

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
  `serverFn`, or use a **type-only** import (`import type ...`) — the same
  applies to `*.server.ts` files themselves: type-only imports are allowed,
  value imports are not.

## Safe patterns

- Secrets live **only** inside `serverFn` handlers; only schema-validated
  `output` leaves the server.
- For credential-dependent page work: create a dedicated `serverFn` (e.g. call a
  third-party API from the server) — never export the key.
- Inspect the server-only file list any time: `bunx moons fns --json`
  (`serverFiles` field).
- **Strict CSP works out of the box**: Moons emits no executable inline
  scripts — the SSR payload is a non-executable `application/x-moons` data
  block and the entry is an external module. A `script-src 'self'` policy does
  not block hydration (verified in a real browser by the CI CSP test).
- Verify: `bunx moons check` — typegen + tsc + client/server build + prerender.
- **Dev**: the SSR payload is scanned automatically — a console warning appears
  if it contains the `leakTest.canary` or a secret-looking env value (≥12
  chars). This is an early signal, not a guarantee; production never scans.

## For AI agents

The boundary is designed so agents cannot "patch around" it dangerously: the
full context pack lives at [Agent context](/ai/context/) and ships offline in
`node_modules/@moonsjs/cli/docs/ai/CONTEXT.md`.
