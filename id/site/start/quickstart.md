---
description: "Buat app Moons pertama: moons create → dev → build → start/deploy, termasuk syarat runtime Bun/Node."
---

# Mulai cepat

Moons berjalan di [Bun](https://bun.sh) ≥ 1.4 (runtime server: Bun atau Node).

## 1. Buat proyek

```bash
bunx --package @moonsjs/cli moons create my-app
cd my-app
```

> Nama bin (`moons`) berbeda dari nama package, jadi `--package` wajib dipakai
> saat memanggil lewat `bunx`.

`create` menyalin template, menulis `AGENTS.md` (peta route + aturan) dan
`llms.txt`, lalu menjalankan `bun install`.

## 2. Jalankan dev server

```bash
bun run dev            # script template: `moons dev` — port 3000, HMR
```

Ubah `src/routes/index.tsx` dan halaman akan menampilkan perubahan tanpa reload
penuh.

## 3. Halaman pertama Anda

```tsx
// src/routes/hello.tsx → /hello
import { useLoaderData } from "@moonsjs/react";

export const loader = async () => ({ pesan: "Halo dari server" });

export default function HelloPage() {
  const data = useLoaderData<typeof loader>();
  return <h1>{data.pesan}</h1>;
}
```

## 4. Verifikasi

```bash
bun run check          # typegen → tsc → build client+server
```

`check` adalah definisi selesai: kalau hijau, tipe aman **dan** batas zero-trust
utuh.

## 5. Build & jalankan produksi

```bash
bun run build          # dist/client/** + dist/server/index.js
bun run start          # NODE_ENV=production; health di /_moons/health
```

Selengkapnya: [Struktur proyek](/id/start/project-structure/) ·
[Deploy](/id/guides/deploy/).

## Perintah CLI

| Perintah | Fungsi |
| --- | --- |
| `bunx moons dev` | Dev server (HMR, port 3000) |
| `bunx moons build` | Build client + server |
| `bunx moons start` | Jalankan hasil build (production, graceful shutdown) |
| `bunx moons check` | typegen → tsc → build (definition of done) |
| `bunx moons routes --json` | Tabel route aktual (bisa `--kind=page`) |
| `bunx moons fns --json` | Registry serverFn (+ `serverFiles`) |
| `bunx moons errors [--json]` | Katalog error: pemicu + saran |
| `bunx moons typegen` | Regenerate `.moons/*.d.ts` |
| `bun test` | Test template in-process (`createTestServer`) |

## Dokumentasi offline untuk agen

Paket `@moonsjs/cli` membundel dokumen agen: baca
`node_modules/@moonsjs/cli/docs/ai/CONTEXT.md` dari dalam proyek Anda.
