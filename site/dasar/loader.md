---
description: "Loader server-side: params, ctx, serialisasi devalue, dan aturan bebas-rahasia karena payload masuk HTML."
---

# Loader — data server-side

`loader` di file route berjalan **di server** (SSR dan navigasi client-side
sama-sama melewati server) dan hasilnya di-embed ke payload HTML.

```tsx
import { useLoaderData, type LoaderArgs } from "@moonsjs/react";

export const loader = async ({ params, ctx, req }: LoaderArgs<"/users/[id]">) => ({
  user: await getUser({ input: { id: params.id } }), // serverFn, in-process saat SSR
  q: new URL(req.url).searchParams.get("q") ?? "",
});

export default function Page() {
  const data = useLoaderData<typeof loader>(); // bertipe dari return loader
  return <p>{data.user.name}</p>;
}
```

- Argumen: `{ params, ctx, req }` — `req` adalah `Request` (baca query string
  dari `new URL(req.url).searchParams`).
- **Kembalikan objek biasa**, bukan `Response` (status/header diatur lewat
  middleware).
- Kode loader ikut ter-compile ke file route (yang merupakan modul client):
  jangan taruh rahasia atau import `node:*` di sini — pindahkan ke
  `*.server.ts` dan panggil sebagai serverFn.

## Serialisasi kaya (devalue)

`Date`, `Map`, `Set`, `BigInt`, `undefined`, `NaN` melewati batas server→client
tanpa berubah tipe:

```tsx
export const loader = async () => ({
  waktu: new Date(),
  harga: new Map([["pro", 19], ["team", 49]]),
});
```

> **Data loader bersifat publik** — ia ada di HTML yang dikirim ke browser.
> Jangan pernah mengembalikan rahasia dari loader.

## Error di loader

Loader yang melempar error merender `_error.tsx` dengan status 500. Lihat
[Error & 404](/dasar/error/).
