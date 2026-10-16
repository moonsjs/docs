---
description: "Link + refresh(): navigasi klien tanpa reload, scroll restoration, dan query param via useSearchParams."
---

# Navigasi & search param

## `Link`

```tsx
import { Link } from "@moonsjs/react";

<Link to="/about">About</Link>
<Link to="/users/[id]" params={{ id: "u1" }}>Profil</Link>
<Link to="/search" search={{ q: "alpha", page: 2 }}>Alpha (hal. 2)</Link>
```

- Merender `<a href>`; klik kiri tanpa modifier menjadi navigasi client-side
  (fetch + swap + hydrate, tanpa reload penuh).
- `params` mengisi segmen dinamis; `search` menambah query string
  (`undefined` dilewati).
- Navigasi ke halaman 404/500 sengaja **full document load**.

## Query string

Loader membaca dari `req.url`; komponen membaca via `useSearchParams()` — nilai
yang sama (di-embed ke payload SSR):

```tsx
export const loader = async ({ req }: LoaderArgs<"/search">) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return { q, hasil: filter(q) };
};

const searchParams = useSearchParams(); // Record<string, string>
```

## `refresh()` — revalidasi

```tsx
import { refresh } from "@moonsjs/react";

await addNote({ input: { title } });
refresh(); // jalankan ulang URL saat ini lewat jalur document-fetch
```

- Tanpa reload penuh; data loader dirender ulang dari server.
- **State lokal (`useState`) di-recreate** pada re-render — jadikan payload
  server sebagai sumber kebenaran; state lokal hanya untuk UI transien.
- **Pending UI (D.4)**: `useNavigation()` memberi `{ pending, url }` — nyala
  sejak navigasi dimulai sampai swap+hidrasi selesai (snapshot SSR selalu
  `pending: false`).
- **Prefetch (D.4)**: `<Link>` melakukan prefetch dokumen saat hover/focus
  (default; cache in-memory TTL ~10 dtk, sekali pakai). Matikan per-link dengan
  `prefetch={false}`. Prefetch tidak pernah menyentuh serverFn/RPC.

## Contoh pending indicator

```tsx
import { Link, useNavigation } from "@moonsjs/react";

export default function Nav() {
  const { pending, url } = useNavigation();
  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>
      {pending ? <span>memuat {url}…</span> : null}
    </nav>
  );
}
```

## Pola lengkap mutation + revalidasi

1. Komponen memvalidasi input dengan schema bersama (`safeParse`).
2. Panggil serverFn.
3. Sukses → `refresh()`; gagal → tampilkan `error.message`.
