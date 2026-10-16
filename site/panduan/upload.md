# Upload file (multipart)

Tidak ada API framework baru: upload adalah **pola `src/api`** (D.1) memakai
`req.formData()` (Web API). Framework tidak menyimpan file — storage adalah
tanggung jawab app (fs/S3/R2).

```ts
// src/api/upload.ts
import type { ApiHandlerArgs } from "@moonsjs/server";

const MAX_BYTES = 64 * 1024;

export const POST = async ({ req }: ApiHandlerArgs): Promise<Response> => {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES + 4096) return Response.json({ error: "terlalu besar" }, { status: 413 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "field `file` wajib" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) return Response.json({ error: "terlalu besar" }, { status: 413 });

  // simpan dengan nama buatan server; jangan percaya file.name/mime
  return Response.json({ name: file.name, size: bytes.byteLength });
};
```

Kode hidup & diuji: [cookbook `src/api/upload.ts`](https://github.com/moonsjs/cookbook/blob/main/src/api/upload.ts).

## Aturan keamanan

- **Batas ukuran dicek route**: `security.bodyLimitBytes` hanya berlaku untuk
  RPC (`/_moons/fn/*`), **tidak** untuk API route. Cek `content-length` **dan**
  panjang byte aktual (header bisa bohong).
- **Jangan percaya metadata klien**: `file.name`/`file.type` tidak dipakai untuk
  path penyimpanan; buat nama server-side (uuid/hash). Validasi tipe via magic
  bytes bila penting.
- Pasang **rate limit** (pola middleware A3) pada endpoint upload.
- Streaming besar: baca `req.body` sebagai stream bila perlu; `formData()`
  memuat ke memori — gunakan batas yang wajar.
- Dokumentasikan batas ke user (pesan 413 yang jelas).
