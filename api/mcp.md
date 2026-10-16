# `@moonsjs/mcp` & the agent context pack

MCP server (stdio, `moons-mcp` bin) + the context documents agents read.
The React API reference (`useSearchParams`, `refresh`, `Link search`) lives in
[`react.md`](react.md); the CLI JSON contract in
[`../ai/cli-json.md`](../ai/cli-json.md).

## MCP tools

| Tool | Input | Output |
|---|---|---|
| `list_routes` | — | Actual route table (same as `moons routes --json`) |
| `get_fn_registry` | — | serverFn registry + `serverFiles` |
| `run_check` | — | `CheckJson` (typegen → tsc → build client/server → prerender) |
| `search_docs` | `{ query }` | Context search: **local** (`node_modules/@moonsjs/cli/docs/ai/CONTEXT.md`) → docs.devmoon.net → pages.dev → GitHub raw |
| `explain_error` | `{ code }` | Catalog: trigger + details + suggestions (`found=false` + `validCodes` when unknown) |

All tools are deterministic; there are no LLM calls in the framework.

## Agent context pack (English)

- `llms.txt` / `llms-full.txt` (repo root; `llms-full` is also on the site).
- `docs/ai/CONTEXT.md` — a compact guide (route anatomy, loaders, serverFn,
  security, navigation, verification).
- `docs/ai/recipes/*` — recipes linking to real code in `examples/cookbook`
  (anti-drift enforced by `scripts/ai/check-ai-links.ts` in CI).
- `moons create` writes `AGENTS.md` (the app's actual route map) + a local
  `llms.txt`; the `cli` package bundles `docs/ai/**` + `llms.txt` for offline
  access.

## CLI JSON contract

`moons routes|fns|check|errors --json` — the stable schemas are documented in
[`../ai/cli-json.md`](../ai/cli-json.md); stderr must stay silent in `--json`
mode (enforced by `scripts/ai/test-cli-introspection.sh`).
