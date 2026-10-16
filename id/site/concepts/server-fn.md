---
description: "serverFn: satu schema dua sisi, hash stabil, RPC x-moons, dan *.server.ts sebagai satu-satunya tempat rahasia."
---

# serverFn — fungsi server yang aman

Tempat **satu-satunya** untuk logika rahasia: file `*.server.ts`.

```ts
// src/server/notes.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";

export const addNote = serverFn({
  input: z.object({ title: z.string().min(1).max(80) }), // wajib
  output: z.object({ id: z.string(), title: z.string() }), // wajib
  handler: async ({ input, ctx }) => ({ id: "n1", title: input.title }),
});
```

## Cara memanggil dari komponen

```tsx
import { addNote } from "../server/notes.server";

await addNote({ input: { title: "Belanja" } });
```

Yang dikirim ke browser adalah **stub RPC** (schema + hash), bukan isi handler.

## Jaminan & aturan

- **Validasi dua sisi**: stub memvalidasi `input` sebelum fetch dan `output`
  sesudahnya; server memvalidasi lagi sebelum/sesudah handler.
- Client hanya boleh meng-import **named export serverFn**. Import default atau
  `import * as` dari `*.server.ts` ditolak build
  (`E_SERVER_IMPORT_IN_CLIENT`).
- **Schema harus inline atau import** dari modul lain (mis.
  `src/shared/schemas.ts`). Schema yang merujuk `const` lokal di file yang sama
  ditolak build (`E_SCHEMA_LOCAL_REF`) — stub tidak membawa deklarasi lokal.
- Saat SSR, pemanggilan berjalan **in-process** (tanpa HTTP).
- Identitas fungsi = hash `sha256("<rel-path>#<export>")` (16 hex) — bisa
  diperiksa dengan `bunx moons fns --json`.
- Error validasi memakai format `[moons] E_RPC_INVALID_INPUT` + saran; tampilkan
  `error.message` bila perlu.

## Query param + mutasi

- Filter lewat query string: lihat [Navigasi & search param](/id/concepts/navigation/).
- Setelah mutasi, panggil [`refresh()`](/id/concepts/navigation/)
  untuk memuat ulang data server.

## Rahasia & env

`env("SECRET")` hanya legal di server (`*.server.ts`); memanggilnya di modul
client menggagalkan build. Nilai publik pakai `import.meta.env.VITE_*`.
