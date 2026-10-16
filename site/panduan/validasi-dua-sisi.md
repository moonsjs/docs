---
description: "Satu schema (Standard Schema/Zod) dipakai client dan server; aturan schema client-safe dan E_SCHEMA_LOCAL_REF."
---

# Panduan: validasi dua sisi

Satu schema, dipakai client **dan** server. Client untuk umpan balik instan;
server karena client tidak pernah bisa dipercaya.

```ts
// src/shared/schemas.ts — diimpor komponen DAN serverFn
import { z } from "zod";
export const addNoteInput = z.object({ title: z.string().min(1).max(80) });
```

```ts
// src/server/notes.server.ts
export const addNote = serverFn({
  input: addNoteInput, // kebenaran di server
  output: noteSchema,
  handler: async ({ input }) => insert(input),
});
```

```tsx
// komponen — cek cepat sebelum menyentuh jaringan
const parsed = addNoteInput.safeParse({ title });
if (!parsed.success) return setError("Judul 1–80 karakter.");
try {
  await addNote({ input: parsed.data });
  refresh();
} catch (error) {
  setError(error instanceof Error ? error.message : String(error));
}
```

- Schema serverFn wajib **inline atau import**; deklarasi lokal ditolak build
  (`E_SCHEMA_LOCAL_REF`). Pesan error kini memuat contoh diff
  **Sebelum/Sesudah** (inline schema atau pindah ke `src/shared/schemas.ts`).
- Server selalu memvalidasi ulang `input` (sebelum handler) dan `output`
  (sesudah); ketidakcocokan muncul sebagai `E_RPC_INVALID_INPUT` /
  `E_RPC_INVALID_OUTPUT`.
- Bukti nyata: [cookbook guard](https://github.com/moonsjs/cookbook/blob/main/src/routes/guard.tsx)
  dan [schema bersama](https://github.com/moonsjs/cookbook/blob/main/src/shared/schemas.ts).
