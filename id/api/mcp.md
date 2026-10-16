# `@moonsjs/mcp` & paket konteks agen

MCP server (stdio, bin `moons-mcp`) + dokumen konteks yang dibaca agen.
Referensi API React (`useSearchParams`, `refresh`, `Link search`) ada di
[`react.md`](react.md); kontrak JSON CLI di
[`../ai/cli-json.md`](../../ai/cli-json.md).

## Tool MCP

| Tool | Input | Output |
|---|---|---|
| `list_routes` | — | Tabel route aktual (sama dengan `moons routes --json`) |
| `get_fn_registry` | — | Registry serverFn + `serverFiles` |
| `run_check` | — | `CheckJson` (typegen → tsc → build client/server → prerender) |
| `search_docs` | `{ query }` | Pencarian konteks: **lokal** (`node_modules/@moonsjs/cli/docs/ai/CONTEXT.md`) → docs.devmoon.net → pages.dev → GitHub raw |
| `explain_error` | `{ code }` | Katalog: trigger + details + suggestions (`found=false` + `validCodes` bila tak dikenal) |
| `audit` | — | Hasil `moons audit --json` (check keamanan + counts) |
| `run_typegen` | — | Menjalankan typegen; mengembalikan `{ ok, outDir: ".moons" }` |
| `scaffold_route` | `{ route, kind?, loader? }` | Membuat `src/routes/<route>.tsx` (page, loader contoh opsional) atau `src/api/<route>.ts` (handler GET) mengikuti konvensi framework; **tidak pernah menimpa** file yang ada |
| `tail_dev_logs` | `{ lines? }` | N baris terakhir (default 50, maks 500) dari log dev terkelola CLI `.moons/dev.log` (ditulis `moons dev`) |

Semua tool deterministik; tidak ada panggilan LLM di framework.

## Paket konteks agen (English)

- `llms.txt` / `llms-full.txt` (root repo; `llms-full` juga di situs).
- Konteks agen — panduan ringkas (anatomi route, loader, serverFn, keamanan,
  navigasi, verifikasi), dibundel di `@moonsjs/cli` pada
  `node_modules/@moonsjs/cli/docs/ai/CONTEXT.md`.
- Resep — pola siap pakai yang bertaut ke kode nyata di
  [cookbook](https://github.com/moonsjs/cookbook), dijaga CI.
- `moons create` menulis `AGENTS.md` (peta route aktual app) + `llms.txt` lokal.

## Kontrak CLI JSON

`moons routes|fns|check|errors --json` — skema stabil didokumentasikan di
[`../ai/cli-json.md`](../../ai/cli-json.md); stderr wajib sunyi di mode `--json`
(dijaga test suite CLI di CI).
