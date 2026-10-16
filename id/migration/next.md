# Migrasi dari Next.js

> Non-blocking. Moons v1 menargetkan aplikasi SSR + data loader +
> RPC ter-tipe — bukan pengganti 1:1 Next.js.

## Pemetaan konsep

| Next.js | Moons |
|---|---|
| `app/users/[id]/page.tsx` | `src/routes/users/[id].tsx` (`export default`) |
| `app/layout.tsx` (root/nested) | `_layout.tsx` di direktori route |
| `not-found.tsx` | `_404.tsx` (root) |
| `error.tsx` (error boundary) | `_error.tsx` (root; `useRouteError()`) |
| `getServerSideProps` / Server Component async | `export const loader` + `useLoaderData<typeof loader>()` |
| Server Actions (`'use server'`) | `serverFn({ input, output, handler })` di `*.server.ts` |
| Route Handlers `app/api/.../route.ts` | `serverFn` (RPC; bukan REST) |
| `NEXT_PUBLIC_API_URL` | `import.meta.env.VITE_API_URL` (Vite) |
| `process.env.SECRET` (server) | `env("SECRET")` (`@moonsjs/server`, server-only) |
| `next/link` | `Link` dari `@moonsjs/react` (`to` + `params`, key gaya file) |
| `useParams()` (client) | `useParams<"/users/[id]">()` |
| `metadata` export | `meta` boleh diekspor (validasi) tetapi **belum dirender v1** — pakai `index.html` |
| Streaming / Suspense / RSC | **Non-tujuan v1** — jangan direncanakan |
| `public/` | `public/` Vite (disalin ke `dist/client`) |
| `next build && next start` | `moons build && moons start` (Bun/Node) |

## Contoh: halaman data + mutasi

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

Mutasi tidak memakai form action: panggil `serverFn` dari client
(`await renameUser({ input: { id, name } })`) — validasi schema di kedua sisi.

## Yang tidak dipetakan (non-tujuan)

- React Server Components, streaming SSR, Suspense progresif.
- Route handlers REST / OpenAPI; gunakan `serverFn` per operasi.
- Image/font optimization, metadata API kompleks, middleware per-route.
- Cache/revalidasi tingkat framework (v1 tidak ada API cache).
- Auth/session/cookie API (v1 tidak ada — tangani lewat `serverFn` + header).

## Checklist pasca-migrasi

1. `moons typegen` (atau build) → pastikan `.moons/*.d.ts` ter-include tsconfig.
2. `bun run tsc --noEmit` hijau (mis. schema drift antar route/server).
3. Audit env: semua akses rahasia lewat `env()` di `*.server.ts`.
4. Pastikan tidak ada import `node:*` di modul client.
5. Jalankan alur CI dugaan Anda → leak test `scripts/m2/test-leak.sh` sebagai
   pola (tambahkan canary di app Anda via `leakTest.canary`).
