---
description: "Routing berbasis file: segmen statis/dinamis/catch-all, layout (boleh bersarang), dan aturan export modul route."
---

# Routing (file-based)

| File | URL | Jenis |
| --- | --- | --- |
| `src/routes/index.tsx` | `/` | page (route key: `index`) |
| `src/routes/about.tsx` | `/about` | page |
| `src/routes/users/index.tsx` | `/users` | page |
| `src/routes/users/[id].tsx` | `/users/:id` | page (dynamic) |
| `src/routes/docs/[...rest].tsx` | `/docs/*` | page (catch-all) |
| `src/routes/_layout.tsx` | — | layout untuk semua page di bawahnya |
| `src/routes/_404.tsx` | — | halaman 404 kustom (root-only) |
| `src/routes/_error.tsx` | — | boundary error (root-only) |

Aturan penting:

- `[...rest]` wajib segmen **terakhir**; dua route yang resolve ke path sama
  menggagalkan build (`E_ROUTE_CONFLICT`).
- `_layout.tsx` membungkus page dari root→leaf (boleh bersarang per folder).
  Contoh hidup: layout root + [`notes/_layout.tsx`](https://github.com/moonsjs/cookbook/blob/main/src/routes/notes/_layout.tsx)
  (diverifikasi E2E: marker hanya muncul di `/notes/**`).

## Middleware direktori & error boundary bersarang 

```ts
// src/routes/admin/_middleware.ts — berlaku untuk seluruh subtree
import type { MiddlewareArgs } from "@moonsjs/core";

export default async function adminGuard({ req, ctx, next }: MiddlewareArgs): Promise<Response> {
  if (ctx.demoUser === null) {
    return new Response(null, { status: 302, headers: { location: "/login" } });
  }
  return next();
}
```

- Chain: `config.middleware` global → `_middleware` root→leaf → render page.
  Middleware membungkus penuh request subtree (html); RPC `/_moons/fn/*` **tidak**
  dibungkus middleware direktori (proteksi RPC = global + guard `ctx` di serverFn).
- Pohon `src/api` punya `_middleware.ts` sendiri (berlaku untuk endpoint di bawahnya).
- `_error.tsx` kini boleh **di direktori mana pun**: boundary terdekat dari page
  yang error yang dipakai (fallback root). `_404.tsx` tetap root-only.
- Bentuk salah → `E_MIDDLEWARE_INVALID` (build merah untuk export, runtime 500
  untuk return non-`Response`).
- Export selain yang diizinkan menggagalkan build (`E_ROUTE_EXPORT_INVALID`) —
  helper murni taruh di `src/shared/`.

## Tipe route otomatis

Typegen (jalan otomatis di dev/build/`moons check`) menghasilkan
`.moons/routes.d.ts`, sehingga loader dan `Link` bertipe ketat:

```tsx
export const loader = async ({ params }: LoaderArgs<"/users/[id]">) => ({
  user: await getUser({ input: { id: params.id } }),
});
```

## Navigasi antar route

```tsx
import { Link } from "@moonsjs/react";

<Link to="/about">About</Link>
<Link to="/users/[id]" params={{ id: "u1" }}>Profil</Link>
<Link to="/search" search={{ q: "alpha" }}>Cari alpha</Link>
```

Klik kiri tanpa modifier = navigasi client-side (fetch + swap + hydrate).
Selengkapnya: [Navigasi & search param](/dasar/navigasi/).
