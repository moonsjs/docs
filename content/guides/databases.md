---
title: Working with Databases
description: Keep database clients on the server, query them through server functions, and run migrations with plain Bun scripts.
---

Database code holds credentials and SQL, so it stays on the server; `serverFn` decides what may cross back.

## The boundary

A route file is a client module. Its loader runs on the server, but the module is still part of the client build, so importing the pool there fails:

```bash
[moons] E_SERVER_IMPORT_IN_CLIENT
importing `pool` from src/server/db.server.ts
```

Only a `serverFn` may cross. Importing the driver directly is rejected earlier:

```bash
[moons] E_FORBIDDEN_SERVER_IMPORT
importing `pg` — server-only package `pg`
```

`pg` is on the built-in server-only list, with `postgres`, `drizzle-orm`, `@prisma/client`, and others. A client import that resolves into `src/server` without the `*.server.ts` suffix is also rejected with `E_FORBIDDEN_SERVER_IMPORT`; both the directory and the suffix are enforced. Drivers outside the list can be added with `security.serverOnlyPackages` in `moons.config.ts`.

Create the client in `src/server/db.server.ts`:

```bash
bun add pg && bun add -d @types/pg
```

```ts
// src/server/db.server.ts
import { env } from "@moonsjs/server";
import { Pool } from "pg";

const connectionString = env<string | undefined>("DATABASE_URL");
if (connectionString === undefined) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({ connectionString, max: 10 });
```

The module is evaluated once per process, so every request shares the pool; never create a client inside a loader or handler.

## A schema and a server function

Put shared schemas in a client-safe module; they are compiled into the stub, so they may describe public data only.

```ts
// src/shared/notes.ts
import { z } from "zod";

export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  updatedAt: z.date(),
});
```

The server function runs the query and returns only what the page displays:

```ts
// src/server/notes.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";
import { noteSchema } from "../shared/notes";
import { pool } from "./db.server";

export const listNotes = serverFn({
  input: z.object({ limit: z.number().int().min(1).max(50) }),
  output: z.array(noteSchema),
  handler: async ({ input }) => {
    const result = await pool.query<{ id: string; title: string; updated_at: Date }>(
      `select id, title, updated_at
         from notes
        order by updated_at desc
        limit $1`,
      [input.limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updated_at,
    }));
  },
});
```

Select columns explicitly: loader data is embedded in the HTML payload and is public, so select only what the page shows.

## Calling it from a loader

The loader imports the server function, never `db.server.ts`:

```tsx
// src/routes/notes.tsx
import { useLoaderData } from "@moonsjs/react";
import { listNotes } from "../server/notes.server";

export const loader = async () => ({
  notes: await listNotes({ input: { limit: 20 } }),
});

export default function NotesPage() {
  const { notes } = useLoaderData<typeof loader>();
  return (
    <ul>
      {notes.map((note) => (
        <li key={note.id}>
          {note.title} — {note.updatedAt.toDateString()}
        </li>
      ))}
    </ul>
  );
}
```

During SSR the call is in-process. Client navigation fetches a freshly rendered document, so the loader runs on the server again; the browser never sees SQL.

## Reaching the pool through ctx

If several server functions need the same handle, create a lazy singleton and attach it in `context(req)`:

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";
import { env } from "@moonsjs/server";
import { Pool } from "pg";

let pool: Pool | undefined;

export default defineConfig({
  routesDir: "src/routes",
  context: async () => ({
    requestId: crypto.randomUUID(),
    db: (pool ??= new Pool({ connectionString: env<string>("DATABASE_URL") })),
  }),
});
```

The first request creates the pool; later requests reuse it. Never construct one per request. Typegen adds the field to the global `Ctx` type, so `ctx.db` is typed in loaders, middleware, server functions, and API handlers. See [Context & Environment](/core-concepts/context-and-environment).

## Migrations and seeds

Run migrations and seeds as plain Bun scripts:

```sql
-- db/migrations/0001_notes.sql
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  updated_at timestamptz not null default now()
);
```

```ts
// scripts/migrate.ts
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env["DATABASE_URL"];
if (connectionString === undefined) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString });
const sql = await readFile(new URL("../db/migrations/0001_notes.sql", import.meta.url), "utf8");
await pool.query(sql);
await pool.end();
console.log("migration applied");
```

```ts
// scripts/seed.ts
import { Pool } from "pg";

const connectionString = process.env["DATABASE_URL"];
if (connectionString === undefined) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString });
await pool.query("insert into notes (title) values ($1), ($2)", ["First note", "Second note"]);
await pool.end();
```

```bash
bun scripts/migrate.ts
bun scripts/seed.ts
```

Scripts open their own pool and close it with `pool.end()`.

## serverFn or API route?

| Need | Use |
| --- | --- |
| A page loader reads rows | `serverFn` called from the loader |
| A component creates, updates, or deletes a row | `serverFn` plus `refresh()` |
| A payment provider calls a webhook | `src/api` route |
| A caller needs a file, custom status, or raw headers | `src/api` route |

Both run on the server and both can use the pool. `serverFn` carries schemas and a stable RPC endpoint; a route under `src/api` is plain HTTP with no origin check and no RPC body limit, so verify signatures and sessions yourself. See [API Routes](/guides/api-routes). For the build rules, read [Zero-Trust Model](/core-concepts/zero-trust).
