# Moons documentation

Sumber situs **https://docs.devmoon.net** — dibangun **dengan Moons sendiri**
(dogfooding): seluruh halaman di-prerender menjadi file statis dan dideploy di
Cloudflare Pages, dengan navigasi klien tetap hidup dari payload `#__moons_data`.

## Cara kerja

- Konten berupa markdown: `site/**` (EN, default), `id/**` (Indonesia),
  `api/**`, `migration/**`, `manifest.md`, dan `ai/**` (konteks agen).
- `scripts/prepare-content.ts` merender markdown → HTML (marked + shiki) lalu
  menulis `src/generated/content.json`, `public/raw/**`, `llms.txt`,
  `llms-full.txt`, dan `_redirects`. **Tautan internal divalidasi di sini** —
  tautan rusak = build gagal.
- Aplikasi (`src/routes/**`) membaca konten hanya di server lewat plugin Vite
  `virtual:moons-docs-content` (environment `ssr`); browser memakai payload
  `#__moons_data`, sehingga bundle klien tetap ramping.
- `moons build` melakukan prerender seluruh route (`prerender + paths`) termasuk
  `404.html`. `scripts/postbuild.ts` menjalankan Pagefind dan menyusun `dist/`
  sebagai tree statis siap-deploy.
- Pencarian = Pagefind statis. URL lama dialihkan lewat `public/_redirects`.

## Perintah

```bash
bun install
bun run content   # regenerate content.json + file public
bun run dev       # moons dev → http://localhost:3000
bun run check     # guard (rujukan internal + tautan cookbook; butuh COOKBOOK_DIR)
bun run build     # content + moons build + postbuild (pagefind, dist/)
bun run smoke     # static server murni + Playwright (nav, tema, 404)
```

Untuk `bun run check`, sediakan clone cookbook:

```bash
git clone --depth 1 https://github.com/moonsjs/cookbook ../moons-cookbook
# atau: COOKBOOK_DIR=/path/ke/cookbook bun run check
```

## Deploy

Cloudflare Pages: repository `moonsjs/docs`, output `dist`.

**Build command** (ganti di Settings → Build configuration):

```bash
curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.2" && export PATH="$HOME/.bun/bin:$PATH" && bun install --frozen-lockfile && bun run build
```

Perintah ini mem-bootstrap **bun 1.4.2** karena `moons build` menjalankan Vite
dan prerender via bun (desain framework), sedangkan image bawaan Cloudflare
memakai bun 1.2.15 yang **tidak bisa mem-parse kode minified React 19.3**
(`else a: if` → parser error) sehingga prerender gagal. Lockfile repo ini
`lockfileVersion: 1` + `bunfig.toml` `linker = "hoisted"` agar konsisten
antarversi bun.

Alternatif tanpa mengubah command: set env **`BUN_VERSION=1.4.2`**
(Production & Preview). Guard `scripts/prepare-content.ts` akan gagal cepat
dengan pesan jelas bila bun < 1.4.

Bugs dan permintaan: buka Issue di repo ini.
