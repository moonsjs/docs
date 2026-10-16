---
description: "meta({ data }) dieksekusi server-side → title/description/Open Graph saat SSR dan setelah navigasi klien."
---

# Meta (judul & SEO)

`meta` mengekspor objek dari data loader — dieksekusi **server-side** dan
otomatis diterapkan ke `<title>`, `description`, dan Open Graph, baik saat SSR
maupun **navigasi client-side**.

```tsx
import { useLoaderData, type RouteMetaFn } from "@moonsjs/react";

export const loader = async () => ({ nama: "Alice" });

export const meta: RouteMetaFn<typeof loader> = ({ data }) => ({
  title: `Profil ${data.nama} — App`,
  description: "Halaman profil pengguna.",
});
```

- `meta` hanya legal di **page** (bukan `_layout`/`_error`/`_404`); bentuk lain
  → `E_ROUTE_EXPORT_INVALID`.
- `data` adalah hasil loader **page itu sendiri**.
- Key tambahan di `RouteMeta` diizinkan (`[key: string]: unknown`) — dipakai
  untuk kebutuhan seperti `og:image` di masa depan; saat ini `title` dan
  `description` yang dirender ke `<head>`.
- Nilai ikut payload SSR, sehingga judul dokumen ikut berubah saat navigasi
  klien (tanpa reload).

> Template `moons create` sudah menyertakan `<title>` placeholder; `meta`
> menimpanya. Untuk tag tambahan (analytics dsb.) edit `index.html`.
