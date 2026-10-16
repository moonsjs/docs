# Endpoint HTTP — `src/api/*.ts`

Untuk webhook, sitemap, upload, callback OAuth: endpoint HTTP **mentah** (semua
method) yang berjalan di server build/dev yang sama, tapi **tidak** memakai
stub/RPC.

```ts
// src/api/webhooks/[provider].ts — server-only
import type { ApiHandlerArgs } from "@moonsjs/server";

export const POST = async ({ req, params, ctx }: ApiHandlerArgs): Promise<Response> => {
  const signature = req.headers.get("x-signature") ?? "";
  const raw = await req.text();
  if (!verifySignature(raw, signature, env("WEBHOOK_SECRET"))) {
    return new Response("invalid signature", { status: 401 });
  }
  return new Response(null, { status: 204 });
};
```

- URL = `/<nama-folder>/<path>` → `src/api/hello.ts` = `/api/hello`;
  `[param]`, `[...rest]`, dan `(group)` sama seperti route halaman; konfigurasi
  lewat `apiDir` (default `"src/api"`).
- Export yang legal **hanya** method handler: `GET`, `HEAD`, `POST`, `PUT`,
  `PATCH`, `DELETE`, `OPTIONS`. Export lain (termasuk `default`) → build merah
  `E_API_HANDLER_INVALID`.
- Handler menerima `{ req, params, ctx }`; `ctx` sama dengan halaman/serverFn
  (context + extender plugin). Middleware global **berlaku**; `_middleware`
  direktori (D.3) juga.
- `HEAD` otomatis dari `GET` (body kosong); `OPTIONS` otomatis → `204` +
  `Allow`; method tanpa handler → `405` + `Allow`.
- `moons routes --json` menampilkan entri `kind: "api"` + `methods`.

## Sitemap contoh

```ts
// src/api/sitemap.ts
export const GET = (): Response =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>/</loc></url></urlset>`,
    { headers: { "content-type": "application/xml" } },
  );
```

## Model keamanan (baca ini)

- File `src/api/**` **server-only**: import dari route/komponen client
  **menggagalkan build** (`E_FORBIDDEN_SERVER_IMPORT`, pesan menyebut "modul
  API server-only").
- **CSRF/origin check RPC tidak berlaku di sini.** Endpoint API mentah — webhook
  pihak ketiga tidak punya `x-moons`/Origin kita. Tanggung jawab route:
  verifikasi signature/token, atau pasang proteksi di middleware global.
- API **tidak** terkena `security.bodyLimitBytes`; batasi sendiri bila perlu
  (mis. cek `content-length`).
- Jangan mengembalikan detail internal di error; pola `E_INTERNAL`-style 
  tetap berlaku (production menyamarkan pesan handler yang melempar).
