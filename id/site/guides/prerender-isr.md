# Prerender statis (SSG)

Halaman statis (blog, docs, marketing) dirender menjadi file HTML saat
`moons build`; runtime menyajikan file itu lebih dulu (tanpa SSR). Hidrasi tetap
sama (shell + payload `__moons_data`).

```tsx
// src/routes/blog/index.tsx — halaman statis
export const prerender = true;

export default function BlogIndex() {
  return <p>blog</p>;
}
```

```tsx
// src/routes/blog/[slug].tsx — dynamic WAJIB `paths`
export const prerender = true;
export const paths = () => [{ slug: "hello" }, { slug: "kedua" }];

export const loader = async ({ params }: LoaderArgs<"/blog/[slug]">) => ({
  title: posts[params.slug],
});
```

- `prerender: true` hanya di **page**; dirender saat build.
- Dynamic route tanpa `paths` → **build merah** (`E_PRERENDER_NO_PATHS`).
- Loader jalan build-time: `req` sintetis (tanpa cookie/auth), `ctx` =
  `config.context(req)`; gunakan `ctx.__prerender === true` untuk bercabang.
  `env()` bebas — tapi **jangan** kembalikan rahasia (§ guard di bawah).
- `notFound()` → path dilewati (404 runtime tetap SSR). `redirect()` saat
  prerender → build gagal (`E_PRERENDER_INVALID`).
- Output `dist/client/<path>/index.html`; manifest `_moons_prerender.json`
  membuat static server hanya melayani path yang benar-benar ter-prerender
  (path lain tetap SSR — jadi tidak ada halaman "menghilang").
- Middleware global/`_middleware` **tidak dijalankan** saat build; file statis
  tidak mendapat header dari middleware (atur header statis via reverse proxy /
  `_headers`).

## Guard zero-trust (penting)

Software scan berjalan **fail-mode** saat prerender: bila HTML memuat canary
`leakTest.canary` atau nilai env bernama mirip-rahasia (≥12 karakter) → build
**gagal** `E_PRERENDER_LEAK`. Alasannya: HTML statis permanen — kebocoran di
sana tidak bisa dimitigasi runtime.

```txt
[moons] E_PRERENDER_LEAK — src/routes/blog/[slug].tsx
hasil prerender `/blog/hello` memuat env(DB_SECRET)
```

## ISR / `revalidate` 

```tsx
export const prerender = true;
export const revalidate = 60; // detik; 0 = selalu diregenerasi saat request
```

- Saat file statis **kedaluwarsa** (> `revalidate` detik), server menyajikan
  file lama (stale-while-revalidate) sambil meregenerasi di background via SSR
  in-process; permintaan berikutnya menyajikan konten baru.
- Regenerasi **fail-closed**: bila HTML baru memuat canary/nilai env
  mirip-rahasia, file lama **tidak ditimpa** (log peringatan).
- Tulis atomik (tmp + rename), dedupe per path; status non-200/redirect tidak
  menimpa file.
- `revalidate` tanpa `prerender` atau nilai bukan number ≥ 0 → build gagal
  `E_ISR_INVALID`.
- Batasan: single-instance (multi-instance → CDN/reverse proxy atau store
  bersama); belum ada invalidasi terprogram (`refresh()` tetap request-scoped).
- Pratinjau: file `_moons_prerender.json` (v2) menyimpan `revalidate` per path.

## Beberapa instance

Secara bawaan tiap instance menyimpan file sendiri, sehingga hasil regenerasi
tidak menyebar. Konfigurasikan `isr.storage` bersama (sebuah `PrerenderStorage`
dengan `read`/`write`) agar penyajian dan regenerasi berlaku lintas instance —
lihat referensi Vite untuk bentuknya.

Contoh store (SQLite via `bun:sqlite`, satu mesin):

```ts
// src/shared/isr-storage.ts
import { Database } from "bun:sqlite";
import type { PrerenderStorage } from "@moonsjs/core";

export function createSqliteStorage(file: string): PrerenderStorage {
  const db = new Database(file);
  db.run(
    "CREATE TABLE IF NOT EXISTS moons_prerender (path TEXT PRIMARY KEY, body BLOB NOT NULL, mtime_ms INTEGER NOT NULL)",
  );
  return {
    async read(pathname) {
      const row = db
        .query("SELECT body, mtime_ms FROM moons_prerender WHERE path = ?")
        .get(pathname) as { body: Uint8Array; mtime_ms: number } | null;
      return row === null ? null : { body: new Uint8Array(row.body), mtimeMs: row.mtime_ms };
    },
    async write(pathname, body) {
      db.run(
        "INSERT INTO moons_prerender (path, body, mtime_ms) VALUES (?, ?, ?) " +
          "ON CONFLICT(path) DO UPDATE SET body = excluded.body, mtime_ms = excluded.mtime_ms",
        [pathname, body, Date.now()],
      );
    },
  };
}
```

Pasang di `moons.config.ts` (`isr: { storage: createSqliteStorage("isr.sqlite") }`),
lalu **hangatkan store saat deploy**: salin semua path dari manifest prerender
(`dist/client/_moons_prerender.json`) ke store sebelum instance dilayani.
Instance yang berbagi store langsung membaca regenerasi satu sama lain.
Path yang **tidak ada** di store otomatis jatuh ke `dist/client`
(aset, halaman non-ISR) — store selalu menang untuk entri yang dimilikinya,
sehingga penyajian dan regenerasi tetap bersama tanpa kasus khusus aset. Untuk
mesin yang tidak bisa berbagi file, implementasikan dua method yang sama di
atas Redis/S3/database — kontraknya (`read` → `{ body, mtimeMs }`, `write`)
seluas itu saja.

Sketsa Redis dengan dua method yang sama (klien Redis apa pun):

```ts
export function createRedisStorage(redis: RedisLike): PrerenderStorage {
  return {
    async read(pathname) {
      const value = await redis.get(`moons:prerender:${pathname}`);
      if (value === null) return null;
      const { body, mtimeMs } = JSON.parse(value); // body: base64
      return { body: Buffer.from(body, "base64"), mtimeMs };
    },
    async write(pathname, body) {
      await redis.set(
        `moons:prerender:${pathname}`,
        JSON.stringify({ body: Buffer.from(body).toString("base64"), mtimeMs: Date.now() }),
      );
    },
  };
}
```

