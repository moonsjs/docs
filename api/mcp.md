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
| `audit` | — | Result of `moons audit --json` (security checks + counts) |
| `run_typegen` | — | Runs typegen; returns `{ ok, outDir: ".moons" }` |
| `scaffold_route` | `{ route, kind?, loader? }` | Creates `src/routes/<route>.tsx` (page, optional sample loader) or `src/api/<route>.ts` (GET handler) following the framework conventions; **never overwrites** an existing file |
| `tail_dev_logs` | `{ lines? }` | Last N lines (default 50, max 500) of the CLI-managed dev log `.moons/dev.log` (written by `moons dev`) |

All tools are deterministic; there are no LLM calls in the framework.

## Agent context pack (English)

- `llms.txt` / `llms-full.txt` (repo root; `llms-full` is also on the site).
- Agent context — a compact guide (route anatomy, loaders, serverFn, security,
  navigation, verification), bundled in `@moonsjs/cli` at
  `node_modules/@moonsjs/cli/docs/ai/CONTEXT.md`.
- Recipes — task-oriented patterns that link to real code in the
  [cookbook](https://github.com/moonsjs/cookbook), kept in sync by CI.
- `moons create` writes `AGENTS.md` (the app's actual route map) plus a local
  `llms.txt`.

## CLI JSON contract

`moons routes|fns|check|errors --json` — the stable schemas are documented in
[`../ai/cli-json.md`](../ai/cli-json.md); stderr must stay silent in `--json`
mode (enforced by the CLI test suite in CI).
