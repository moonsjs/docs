# Moons documentation

Sumber situs **https://docs.devmoon.net** (Astro Starlight, deploy lewat
Cloudflare Pages). Markdown staf di repo ini; hasil generate tidak di-commit.

## Isi repo

- `site/**` — halaman dokumentasi (Bahasa Indonesia).
- `site-en/**` — terjemahan Inggris (diterbitkan di `/en/**`).
- `ai/**` — konteks agen (English) + resep yang menautkan
  [cookbook](https://github.com/moonsjs/cookbook) sebagai sumber pola.
- `api/**`, `migration/**`, `manifest.md` — referensi paket, migrasi, arsitektur.
- `llms.txt` — indeks konteks agen (dibundel juga di paket `@moonsjs/cli`).
- `scripts/build.ts` — generate `src/content/docs/**`, `public/raw/**`,
  `public/llms.txt`, `public/llms-full.txt`.
- `scripts/check-public.ts` — guard: dokumentasi publik dilarang memuat rujukan
  internal (PRD/§/Addendum).
- `scripts/check-links.ts` — anti-drift tautan relatif + tautan cookbook.

## Build

```bash
bun install
bun run check   # butuh cookbook: git clone --depth 1 https://github.com/moonsjs/cookbook examples/cookbook
bun run build   # generate + astro build → dist/
```

## Deploy

Cloudflare Pages: repository `moonsjs/docs`, build command
`bun install && bun run build`, output `dist`, env `BUN_VERSION=1.4.2`.

Bugs dan permintaan: buka Issue di repo ini.
