---
description: "Model zero-trust Moons: stub RPC menggantikan *.server.ts, import terlarang menggagalkan build, leak test canary."
---

# Model keamanan: zero-trust

Janji Moons sederhana: **kode server tidak bisa bocor ke client** — dan
upayanya menggagalkan build.

## Tiga lapis penegakan

1. **Transform** — setiap `*.server.ts` yang masuk graph client diganti
   **stub RPC** (hanya schema + hash). Isi handler, helper, dan import
   server-only dibuang.
2. **Rejection build** — import ilegal menggagalkan build dengan format
   `[moons] CODE` + `Saran:`:
   - nilai non-serverFn dari `*.server.ts` → `E_SERVER_IMPORT_IN_CLIENT`
   - `env()` di modul client → `E_ENV_IN_CLIENT`
   - import `node:*`/`bun:*` di modul client → `E_FORBIDDEN_SERVER_IMPORT`
   - schema serverFn yang merujuk deklarasi lokal → `E_SCHEMA_LOCAL_REF`
3. **Canary leak test** — setel `leakTest.canary` di `vite.config.ts`; bila
   string itu muncul di output client, build gagal. Di CI, leak test dianggap
   tes sacred: merah = merge dilarang.

## Yang publik vs privat

| Publik (boleh masuk browser) | Privat (hanya server) |
| --- | --- |
| Semua file `src/routes/**`, `src/client/**`, `src/shared/**` | Isi `src/server/*.server.ts` |
| **Data loader** (di-embed ke HTML!) | `env()`, kredensial, akses DB |
| Nilai `import.meta.env.VITE_*` | `ctx` (context server-side) |

> Kesalahan paling umum: mengira loader "aman". Data loader muncul di payload
> HTML — jangan pernah mengembalikan rahasia dari loader.

## Paket server-only 

Import paket npm server-only dari modul client **menggagalkan build**
(`E_FORBIDDEN_SERVER_IMPORT`) — bukan sekadar peringatan:

- **Daftar bawaan** (contoh): `pg`, `postgres`, `mysql2`, `better-sqlite3`,
  `drizzle-orm`, `@prisma/client`, `prisma`, `mongodb`, `mongoose`, `redis`,
  `bcrypt`, `jsonwebtoken`, `nodemailer`, `sharp`, `dotenv`, `knex`,
  `typeorm`, `sequelize`, … — daftar penuh di
  [referensi core](/api/core/); daftar bawaan tidak bisa dihapus app.
- **`security.serverOnlyPackages`** — tambahan daftar milik app (paket internal
  yang server-only).
- **Marker paket** — `package.json` sebuah dependency boleh menandai dirinya:
  `{ "moons": { "serverOnly": true } }` (untuk package workspace/mirror).
- Pencocokan lewat **nama paket hasil resolve**: subpath
  (`@prisma/client/runtime`), alias Vite, `tsconfig paths`, symlink/workspace
  ikut tertangkap.
- **Way out** yang sah: pindahkan import ke `*.server.ts` dan panggil lewat
  `serverFn`, atau impor **type-only** (`import type ...`) yang terhapus saat
  kompilasi.

```txt
[moons] E_FORBIDDEN_SERVER_IMPORT — src/routes/x.tsx:2
mengimpor `pg` — paket server-only `pg`
Sumber kecocokan: daftar bawaan paket server-only framework.
Saran:
  1. Pindahkan operasi tersebut ke `*.server.ts` dan panggil lewat serverFn
  2. Atau ganti/hapus import tersebut di modul client
```

## Pola aman

- Rahasia dipakai **hanya** di dalam handler `serverFn`; yang keluar hanyalah
  `output` yang tervalidasi schema.
- Untuk operasi bergantung kredensial di halaman: buat `serverFn` khusus
  (mis. memanggil API pihak ketiga dari server) — bukan mengekspor kunci.
- Periksa daftar file server-only kapan pun: `bunx moons fns --json`
  (field `serverFiles`).
- Verifikasi: `bunx moons check` — typegen + tsc + build client/server.
- **Dev**: payload SSR dipindai otomatis — peringatan di konsol bila memuat
  canary `leakTest.canary` atau nilai env bernama mirip rahasia (≥12 karakter).
  Ini indikator awal, bukan jaminan; production tidak memindai (tanpa biaya).

## Untuk agen AI

Batas ini dirancang agar agen tidak "menambal" dengan cara berbahaya: paket
konteks lengkap ada di [Agent context](/ai/context/) dan dibundel offline di
`node_modules/@moonsjs/cli/docs/ai/CONTEXT.md`.
