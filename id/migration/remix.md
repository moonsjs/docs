# Migrasi dari Remix

> Non-blocking. Remix dan Moons sama-sama file-routing + loader di
> server; perbedaan utamanya: **mutasi Moons lewat RPC ter-tipe**, bukan form
> action/progressive enhancement (non-tujuan v1).

## Pemetaan konsep

| Remix | Moons |
|---|---|
| `app/routes/users.$id.tsx` | `src/routes/users/[id].tsx` |
| `app/root.tsx` + nested `_layout` | `_layout.tsx` di direktori route |
| `ErrorBoundary` export | `_error.tsx` (root; `useRouteError()`) |
| `CatchBoundary` / 404 | `_404.tsx` (root) |
| `export const loader` (`{ params, request }`) | `export const loader` (`{ params, req, ctx }`) |
| `useLoaderData<typeof loader>()` | `useLoaderData<typeof loader>()` (sama) |
| `export const action` + `<Form>` | `serverFn` + panggilan dari client |
| `json()` / `defer()` | return value biasa (devalue menjaga `Date`/`Map`/dst.) |
| `useFetcher` / `useNavigation` | **belum ada v1** (tanpa pending-state API) |
| `NavLink` | `Link` (tanpa `isActive` bawaan v1) |
| `useRouteError()` | `useRouteError()` (di `_error.tsx`) |
| `headers`/cookie session | v1 tidak ada API cookie/session; gunakan `serverFn` |
| `remix build && remix-serve build` | `moons build && moons start` |
| `.server.ts` (konvensi Remix) | `*.server.ts` + transform zero-trust |

## Contoh: loader + mutasi

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
    window.location.reload(); // v1 tanpa revalidation/optimistic API
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

## Yang tidak dipetakan (non-tujuan)

- Form actions/progressive enhancement berbasis HTML form, `useFetcher`,
  revalidation otomatis, pending/optimistic UI.
- Streaming/defer, resource routes REST, `headers` API per-route.
- Cookie/session API tingkat framework.

## Checklist pasca-migrasi

1. `moons typegen` → `.moons/*.d.ts` ter-include di tsconfig.
2. `bun run tsc --noEmit` hijau (tipe `input`/`output` serverFn mengikat client).
3. Pindahkan seluruh akses rahasia ke `*.server.ts` + `env()`.
4. Tidak ada import `node:*` di modul client (`E_FORBIDDEN_SERVER_IMPORT`).
5. Tambahkan `leakTest.canary` pada app Anda (opsional) + jalankan leak test
   dengan pola `scripts/m2/test-leak.sh`.
