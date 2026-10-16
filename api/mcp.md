# `@moonsjs/mcp` & paket konteks agen

MCP server (stdio, bin `moons-mcp`) + dokumen konteks yang dibaca agen.
Referensi API React (`useSearchParams`, `refresh`, `Link search`) ada di
[`react.md`](./react.md); kontrak JSON CLI di
[`../ai/cli-json.md`](../ai/cli-json.md).

## Tool MCP

| Tool | Input | Output |
|---|---|---|
| `list_routes` | — | Tabel route aktual (sama dengan `moons routes --json`) |
| `get_fn_registry` | — | Registry serverFn + `serverFiles` |
| `run_check` | — | `CheckJson` (typegen → tsc → build client/server → prerender) |
| `search_docs` | `{ query }` | Pencarian konteks: **lokal** (`node_modules/@moonsjs/cli/docs/ai/CONTEXT.md`) → docs.devmoon.net → pages.dev → GitHub raw |
| `explain_error` | `{ code }` | Katalog: trigger + details + suggestions (`found=false` + `validCodes` bila tak dikenal) |

Semua tool deterministik; tidak ada panggilan LLM di framework.

## Paket konteks agen (English)

- `llms.txt` / `llms-full.txt` (root repo; `llms-full` juga di situs).
- `docs/ai/CONTEXT.md` — panduan ringkas (anatomi route, loader, serverFn,
  keamanan, navigasi, verifikasi).
- `docs/ai/recipes/*` — resep bertaut ke kode nyata `examples/cookbook`
  (anti-drift dijaga `scripts/ai/check-ai-links.ts` di CI).
- `moons create` menulis `AGENTS.md` (peta route aktual app) + `llms.txt` lokal;
  paket `cli` membundel `docs/ai/**` + `llms.txt` untuk akses offline.

## Kontrak CLI JSON

`moons routes|fns|check|errors --json` — skema stabil didokumentasikan di
[`../ai/cli-json.md`](../ai/cli-json.md); stderr wajib sunyi di mode `--json`
(dijaga `scripts/ai/test-cli-introspection.sh`).
