---
description: "Format error [moons] CODE + Saran, _404/_error, redirect()/notFound(), dan apa yang tampil di production."
---

# Error & 404

## Halaman kustom

Dua file **root-only** di `src/routes/`, dirender standalone (tanpa layout):

```tsx
// src/routes/_404.tsx
import { Link } from "@moonsjs/react";
export default function NotFound() {
  return (<div>
    <h1>404 — halaman tidak ditemukan</h1>
    <Link to="/">Kembali</Link>
  </div>);
}
```

```tsx
// src/routes/_error.tsx
import { Link, useRouteError } from "@moonsjs/react";
export default function RouteError() {
  const error = useRouteError();
  const label = error instanceof Error ? error.message : "Terjadi kesalahan internal.";
  return (<>
    <h1>Terjadi kesalahan</h1>
    <pre>{label}</pre>
    <Link to="/">Coba lagi</Link>
  </>);
}
```

- Path tak dikenal → `_404.tsx` (status 404).
- Loader/handler yang melempar → `_error.tsx` (status 500).
- `useRouteError()` mengembalikan error asli **hanya di development**;
  production tidak pernah menaruh detail di payload.

## `redirect` & `notFound` 

Dilempar dari **loader/meta** untuk mengendalikan navigasi dari server:

```tsx
import { notFound, redirect, type LoaderArgs } from "@moonsjs/react";

export const loader = async ({ params }: LoaderArgs<"/users/[id]">) => {
  const user = await getUser({ input: { id: params.id } });
  if (user === null) notFound();          // → halaman _404 kustom, status 404
  if (!user.aktif) redirect("/login", 303); // → HTTP redirect (default 302)
  return { user };
};
```

- `redirect(to, status?)` — `to` relatif di-resolve terhadap request URL;
  status yang didukung: 301/302/303/307/308.
- **Boundary terdekat** (D.3): error di page memakai `_error.tsx` terdekat dari
  direktorinya (naik sampai root), bukan selalu root.
- Navigasi client-side mengikuti redirect lewat `fetch`, dan entri history
  memakai **URL final** — jadi alamat di address bar selalu benar.
- Dokumen yang berakhir 404/500 tetap full document load (bukan SPA swap).

## Format error runtime & build

Semua error memakai format yang sama — kode mesin + lokasi + saran:

```
[moons] E_ROUTE_EXPORT_INVALID

src/routes/about.tsx:3
  export `helper` tidak diizinkan di modul route

Saran:
  1. Hapus export tambahan, atau
  2. Pindahkan helper ke src/shared/
```

Kode yang paling sering Anda temui: [`E_SERVER_IMPORT_IN_CLIENT`](/id/concepts/zero-trust/),
`E_ENV_IN_CLIENT`, `E_SCHEMA_LOCAL_REF`, `E_ROUTE_CONFLICT`,
`E_ROUTE_EXPORT_INVALID`, `E_RPC_INVALID_INPUT`.

> Jangan menambal error build dengan melemahkan plugin/canary — itu justru
> melanggar jaminan zero-trust. Ikuti `Saran:` yang diberikan.
