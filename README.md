# Moons documentation

Sumber situs **https://docs.devmoon.net** (Astro Starlight, deploy lewat
Cloudflare Pages). **English adalah locale default**; Bahasa Indonesia tersedia
di `/id/**` dengan slug yang sama.

## Isi repo

- `site/**` — halaman English (root locale; slug diturunkan dari nama file).
- `id/site/**` — terjemahan Bahasa Indonesia (slug sama, tampil di `/id/**`).
- `api/**`, `migration/**`, `manifest.md` — referensi English (versi ID ada di `id/**`).
- `ai/**` — konteks agen + resep (English; menu pada kedua locale).
- `llms.txt` — indeks konteks agen (dibundel juga di paket `@moonsjs/cli`).
- `src/pages/index.astro` — landing page custom (`/`).
- `src/styles/custom.css` — tema situs.
- `scripts/build.ts` — generate `src/content/docs/**`, `public/raw/**`,
  `public/llms.txt`, `public/llms-full.txt`, `public/_redirects` (redirect URL lama).
- `scripts/check-public.ts` — guard rujukan internal; `scripts/check-links.ts` —
  anti-drift tautan (termasuk verifikasi tautan cookbook).

## Build

```bash
bun install
bun run check   # butuh cookbook: git clone --depth 1 https://github.com/moonsjs/cookbook examples/cookbook
bun run build   # generate + astro build → dist/
```

## Deploy

Cloudflare Pages: repository `moonsjs/docs`, build command
`bun install && bun run build`, output `dist`.

> **Catatan lockfile:** `bun.lock` sengaja ditulis dalam format
> `lockfileVersion: 1` agar kompatibel dengan image Cloudflare Pages
> (bun 1.2.15) sekaligus tetap dibaca bun 1.4.x di CI. Jalankan
> `bun install --frozen-lockfile` (jangan `bun install` polos) supaya lockfile
> tidak di-upgrade otomatis ke v2. Bila Pages disetel `BUN_VERSION=1.4.2`,
> lockfile boleh diregenerasi ke v2.

Bugs dan permintaan: buka Issue di repo ini.
