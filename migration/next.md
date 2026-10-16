# Migrating from Next.js

> Non-blocking. Moons v1 targets SSR + data loader +
> typed RPC apps — it is not a 1:1 Next.js replacement.

## Concept mapping

| Next.js | Moons |
|---|---|
| `app/users/[id]/page.tsx` | `src/routes/users/[id].tsx` (`export default`) |
| `app/layout.tsx` (root/nested) | `_layout.tsx` in the route directory |
| `not-found.tsx` | `_404.tsx` (root) |
| `error.tsx` (error boundary) | `_error.tsx` (root; `useRouteError()`) |
| `getServerSideProps` / async Server Component | `export const loader` + `useLoaderData<typeof loader>()` |
| Server Actions (`'use server'`) | `serverFn({ input, output, handler })` in `*.server.ts` |
| Route Handlers `app/api/.../route.ts` | `serverFn` (RPC; not REST) |
| `NEXT_PUBLIC_API_URL` | `import.meta.env.VITE_API_URL` (Vite) |
| `process.env.SECRET` (server) | `env("SECRET")` (`@moonsjs/server`, server-only) |
| `next/link` | `Link` from `@moonsjs/react` (`to` + `params`, file-style key) |
| `useParams()` (client) | `useParams<"/users/[id]">()` |
| `metadata` export | `meta` may be exported (validated) but it is **not yet rendered in v1** — use `index.html` |
| Streaming / Suspense / RSC | **Non-goal in v1** — do not plan for it |
| `public/` | Vite `public/` (copied to `dist/client`) |
| `next build && next start` | `moons build && moons start` (Bun/Node) |

## Example: a data page + a mutation

**Next.js**

```tsx
// app/users/[id]/page.tsx
export default async function Page({ params }: { params: { id: string } }) {
  const user = await db.users.find(params.id);      // server component
  return <p>{user.name}</p>;
}

// app/actions.ts
"use server";
export async function rename(id: string, name: string) { /* ... */ }
```

**Moons**

```ts
// src/server/users.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";

export const getUser = serverFn({
  input: z.object({ id: z.string() }),
  output: z.object({ id: z.string(), name: z.string() }),
  handler: async ({ input, ctx }) => ctx.db.users.find(input.id),
});

export const renameUser = serverFn({
  input: z.object({ id: z.string(), name: z.string() }),
  output: z.object({ ok: z.boolean() }),
  handler: async ({ input, ctx }) => ({ ok: await ctx.db.users.rename(input.id, input.name) }),
});
```

```tsx
// src/routes/users/[id].tsx
import { useLoaderData, useParams, type LoaderArgs } from "@moonsjs/react";
import { getUser } from "../../server/users.server";

export const loader = async ({ params }: LoaderArgs<"/users/[id]">) => ({
  user: await getUser({ input: { id: params.id } }),
});

export default function UserPage() {
  const { user } = useLoaderData<typeof loader>();
  const { id } = useParams<"/users/[id]">();
  return <h1>{id}: {user.name}</h1>;
}
```

Mutations do not use form actions: call the `serverFn` from the client
(`await renameUser({ input: { id, name } })`) — schema validation on both sides.

## What is not mapped (non-goals)

- React Server Components, streaming SSR, progressive Suspense.
- REST / OpenAPI route handlers; use `serverFn` per operation.
- Image/font optimization, a complex metadata API, per-route middleware.
- Framework-level caching/revalidation (v1 has no cache API).
- Auth/session/cookie API (v1 has none — handle it via `serverFn` + headers).

## Post-migration checklist

1. `moons typegen` (or build) → make sure `.moons/*.d.ts` is included in tsconfig.
2. `bun run tsc --noEmit` green (e.g. schema drift between route/server).
3. Audit env: all secret access goes through `env()` in `*.server.ts`.
4. Make sure there are no `node:*` imports in client modules.
5. Run your expected CI flow → leak test `scripts/m2/test-leak.sh` as a
   pattern (add a canary to your app via `leakTest.canary`).
