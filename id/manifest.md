# Manifest — Mengapa Batas Server/Client Berbahaya

> Dokumen ini menjelaskan posisi Moons terhadap cara framework lain menjaga
> batas server→client. Nada tegas; klaim yang dibuat hanya yang bisa
> diverifikasi dari repo ini (transform rejection build, leak test)
> atau mekanisme publik yang bisa diperiksa di dokumentasi framework terkait.

## 1. Klaim

> **Moons: the full-stack TypeScript framework that makes leaking server code
> to the client impossible.** 

Kebocoran kode server ke bundle client bukan "risiko yang dikelola" — itu
kegagalan kategori. Sekali handler, secret, atau nilai `env()` ikut terkirim ke
browser, tidak ada mitigasi yang menariknya kembali: bundle sudah ada di tangan
pengguna. Karena itu Moons menempatkan kebocoran sebagai **kondisi berhenti
proyek**: kalau transform bisa diakali, framework ini dusta.

## 2. Definisi "mustahil" 

`dist/client/**` MUST NOT memuat:

1. Isi handler `serverFn` (baris apa pun).
2. Import asli `*.server.ts` selain stub RPC.
3. Import `node:*`, `bun:*`, atau modul server-only.
4. Nilai `env()`.
5. Konstanta/string/komentar server.
6. Isi file `*.server.ts` asli (hanya stub).

Ditegakkan tiga lapis: **transform build-time**, **rejection build-time**,
**CI leak test** (canary di-inject, `dist/client` dipindai, build gagal bila
ditemukan).

## 3. Bagaimana kebocoran benar-benar terjadi

Enam jalur yang berulang di praktik:

| # | Jalur | Contoh |
|---|---|---|
| 1 | Import langsung | route mengimpor helper/konstanta dari modul server |
| 2 | Import tidak langsung | barrel `export *` / file perantara menarik modul server |
| 3 | Dynamic import | `await import("./debug.server")` di jalur client |
| 4 | Nilai env | variabel privat ter-inline ke kode client |
| 5 | Body handler | closure/handler ikut lambat dibundel karena modul diimpor utuh |
| 6 | Sisa artefak | komentar, konstanta, source map, stub yang mengembalikan `Response` server |

Semua enam mudah lolos review: yang terlihat di diff hanyalah satu baris import.

## 4. Bagaimana pendekatan umum bekerja

Framework mapan punya jawaban masing-masing — dan jawaban itu pada umumnya
**berbasis konvensi + disiplin**:

- **Prefix publik untuk env** (mis. `NEXT_PUBLIC_`, `PUBLIC_*`): variabel tanpa
  prefix tidak ikut client — selama penamaan benar.
- **Paket/penanda server-only** (mis. `server-only`, direktif `'use server'`,
  folder `$lib/server`, `server/`): import yang salah ditolak compiler *bila*
  penandanya dipasang.
- **Konvensi nama file** (mis. `*.server.ts`): modul server dipisah dari client —
  bergantung pada penamaan yang konsisten.
- **Tree-shaking/edge bundling**: berharap kode tak terpakai dibuang — kegagalan
  bersifat diam (tidak ada error, hanya byte yang terkirim).

Pola-pola ini bekerja cukup baik untuk tim disiplin. Masalahnya: jaminannya
adalah *"tidak boleh"* yang ditegakkan lewat review manusia — bukan *"tidak
bisa"* yang ditegakkan oleh build yang gagal.

## 5. Tiga lapis penegakan Moons

1. **Transform ** — setiap `*.server.ts` yang masuk graph client diganti
 stub: hanya `input`/`output` schema + hash stabil yang tersisa; body
   handler, ekspor non-`serverFn`, dan import `node:*`/`bun:*` **dibuang**.
   Import ilegal (non-`serverFn`, default, namespace, dynamic import tanpa guard
   `DEV`), pemanggilan `env()`, dan import `node:*` **menggagalkan build** dengan
 error lengkap `file:line` + `Saran`.
2. **Rejection build** — aturan yang sama dievaluasi di dev dan build,
 termasuk re-export dan conditional import.
3. **Leak test CI — sacred**: canary ditanam di handler fixture; setelah
   build, `dist/client` dipindai; ditemukan → **merge dilarang**. Fixture
   fixture kebocoran framework juga menyetel `leakTest.canary` sehingga build
   itu sendiri gagal bila canary muncul (dua jalur gagal, satu kebenaran).

Dijaga di CI framework: leak test, test penolakan import, test format error,
dan unit test transform.

## 6. Perbandingan mekanisme

| Pertanyaan | Konvensi umum | Moons |
|---|---|---|
| Batas modul server/client | Nama file / paket penanda / direktif | `*.server.ts` + transform stub (kode asli tidak pernah masuk graph client) |
| Import ilegal | Review + compiler bila ditandai | Build gagal (`E_SERVER_IMPORT_IN_CLIENT`) dengan `file:line` + saran |
| Body handler di client | Bergantung tree-shaking | Handler diganti stub secara struktural; tidak ada jalur "handler utuh" |
| Dynamic import | Umumnya tidak ditegakkan | Ditolak (`E_SERVER_IMPORT_IN_CLIENT`) kecuali branch `DEV` yang mati saat build |
| Env privat | Uji disiplin penamaan | `env()` server-only; dipanggil di client → `E_ENV_IN_CLIENT` (build + runtime) |
| Validasi batas | Opsional per proyek | Wajib schema `input`/`output` di kedua sisi |
| Bukti kebocoran | Test milik tim | Leak test framework-level wajib hijau; merah = merge dilarang |

## 7. Batas jujur

- Kode yang ditulis di modul client **memang untuk client** — Moons tidak
  menyembunyikan apa yang Anda taruh di sana.
- Plugin berjalan di dalam pipeline Vite (route, middleware, konteks); bukan
  sandbox terhadap kode yang memang Anda taruh di modul client.
- `meta` merender title, description, dan Open Graph di server serta
  menyinkronkannya saat navigasi klien.
- Source map client tidak dihasilkan secara bawaan.
- Jaminan berlaku untuk alur build plugin `moons()`; menonaktifkan plugin atau
  mengimpor `.server.ts` lewat jalur non-Vite bukan skenario yang didukung.

## 8. Penutup

Framework lain mengatakan: *"Kami membuat type-safety end-to-end."*
Moons mengatakan: *"Kami membuat kebocoran kode server ke client mustahil.
Kalau kami gagal, kami tidak pantas ada."* 

Kalau Anda menemukan satu jalur yang bisa mengakali itu bukan bug biasa —
itu alasan proyek ini dihentikan sampai diperbaiki.
