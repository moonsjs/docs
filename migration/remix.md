# Migrating from Remix

> Non-blocking. Remix and Moons both do file routing + server
> loaders; the main difference: **Moons mutations go through typed RPC**, not
> form actions/progressive enhancement (non-goal in v1).

## Concept mapping

| Remix | Moons |
|---|---|
| `app/routes/users.$id.tsx` | `src/routes/users/[id].tsx` |
| `app/root.tsx` + nested `_layout` | `_layout.tsx` in the route directory |
| `ErrorBoundary` export | `_error.tsx` (root; `useRouteError()`) |
| `CatchBoundary` / 404 | `_404.tsx` (root) |
| `export const loader` (`{ params, request }`) | `export const loader` (`{ params, req, ctx }`) |
| `useLoaderData<typeof loader>()` | `useLoaderData<typeof loader>()` (identical) |
| `export const action` + `<Form>` | `serverFn` + a call from the client |
| `json()` / `defer()` | a plain return value (devalue preserves `Date`/`Map`/etc.) |
| `useFetcher` / `useNavigation` | **not in v1** (no pending-state API) |
| `NavLink` | `Link` (no `isActive` in v1) |
| `useRouteError()` | `useRouteError()` (in `_error.tsx`) |
| `headers`/cookie session | v1 has no cookie/session API; use `serverFn` |
| `remix build && remix-serve build` | `moons build && moons start` |
| `.server.ts` (Remix convention) | `*.server.ts` + the zero-trust transform |

## Example: loader + mutation

**Remix**

```tsx
// app/routes/users.$id.tsx
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";

export async function loader({ params }: LoaderFunctionArgs) {
  return json({ user: await db.users.find(params.id!) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  await db.users.rename(params.id!, String(form.get("name")));
  return json({ ok: true });
}

export default function UserPage() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <>
      <h1>{user.name}</h1>
      <Form method="post">
        <input name="name" />
        <button>Rename</button>
      </Form>
    </>
  );
}
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
import { getUser, renameUser } from "../../server/users.server";
import { useState } from "react";

export const loader = async ({ params }: LoaderArgs<"/users/[id]">) => ({
  user: await getUser({ input: { id: params.id } }),
});

export default function UserPage() {
  const { user } = useLoaderData<typeof loader>();
  const { id } = useParams<"/users/[id]">();
  const [name, setName] = useState(user.name);

  async function submit() {
    await renameUser({ input: { id, name } });
    window.location.reload(); // v1 has no revalidation/optimistic API
  }

  return (
    <>
      <h1>{user.name}</h1>
      <input value={name} onChange={(event) => setName(event.target.value)} />
      <button onClick={submit}>Rename</button>
    </>
  );
}
```

## What is not mapped (non-goals)

- HTML-form-based form actions/progressive enhancement, `useFetcher`,
  automatic revalidation, pending/optimistic UI.
- Streaming/defer, REST resource routes, per-route `headers` API.
- Framework-level cookie/session API.

## Post-migration checklist

1. `moons typegen` → `.moons/*.d.ts` included in tsconfig.
2. `bun run tsc --noEmit` green (serverFn `input`/`output` types bind the client).
3. Move all secret access into `*.server.ts` + `env()`.
4. No `node:*` imports in client modules (`E_FORBIDDEN_SERVER_IMPORT`).
5. Add `leakTest.canary` to your app (optional) + run the leak test
   following the `scripts/m2/test-leak.sh` pattern.
