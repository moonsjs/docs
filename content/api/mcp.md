---
title: "@moonsjs/mcp"
description: A stdio MCP server that exposes routing, verification, audit, scaffolding, and documentation tools to MCP clients.
---

`@moonsjs/mcp` is a Model Context Protocol server that runs over stdio and answers questions about a Moons app: its route table, server function registry, verification status, and security audit. The tools are deterministic — they reuse the same scanners and catalog data as the CLI and never call an LLM.

## Running the server

The binary is `moons-mcp`:

```bash
bunx --package @moonsjs/mcp moons-mcp
```

Like the CLI, it needs `--package` because the binary name differs from the package name. Tools operate on the directory the server process starts in, so run it from the app root. Point an MCP client at it with a configuration like this:

```json
{
  "mcpServers": {
    "moons": {
      "command": "bunx",
      "args": ["--package", "@moonsjs/mcp", "moons-mcp"]
    }
  }
}
```

The same block works in any client that spawns stdio MCP servers, including coding assistants and editors. If your client supports setting a working directory for a server, point it at the app root; otherwise the directory the client launches the server in is what the tools read.

## Tools

| Tool | Input | Purpose |
| --- | --- | --- |
| `list_routes` | none | Route table of the app (path, file, key, kind, params, layouts) from a scan; no build needed. |
| `get_fn_registry` | none | Every declared `serverFn` with its `file#export` key and hash, plus all scanned server files. |
| `run_check` | none | Runs the full `moons check` pipeline and returns `{ ok, steps }`. |
| `search_docs` | `{ query }` | Searches the bundled documentation; returns matching lines with their section headings. |
| `audit` | none | Runs the security audit: serverFn inventory, `env()` access map, cookie flags, CSP, and a `dist/client` scan. |
| `run_typegen` | none | Regenerates `.moons/routes.d.ts` and `.moons/context.d.ts`; returns `{ ok, outDir }`. |
| `scaffold_route` | `{ route, kind?, loader? }` | Creates a page or API route file following the conventions; never overwrites an existing file. |
| `tail_dev_logs` | `{ lines? }` | Returns the last lines of `.moons/dev.log`, the log written by `moons dev` (default 50, max 500). |
| `explain_error` | `{ code }` | Explains an error code from the catalog; unknown codes return `found: false` plus the list of valid codes. |

`scaffold_route` writes only when asked: a page becomes `src/routes/<route>.tsx` (with an optional sample loader) and an API route becomes `src/api/<route>.ts` with a `GET` handler. If the file already exists, the tool refuses instead of overwriting. `run_typegen` is the one other tool that writes, and only into the generated `.moons` directory.

## Local-first docs search

`search_docs` reads the documentation snapshot bundled with `@moonsjs/cli` in `node_modules`, so it answers from exactly the version you installed and works without network access. If that copy is missing, the search falls back to the online documentation. Queries are case-insensitive substring matches, and every match reports its section heading and line number so a caller can cite and follow up on the exact passage.

`explain_error` uses the same catalog that `moons errors --json` prints: what triggers the code, a short explanation, and numbered fix suggestions. Codes that are not in the catalog return `found: false` together with the full list of valid codes, so a typo is obvious.

## Notes on behavior

- Every tool answers for one project — the directory the server was started in. There is no argument that switches projects mid-session.
- Results are JSON documents, which compose with other tools and are safe to feed to another tool or a script.
- `list_routes`, `get_fn_registry`, `run_check`, `audit`, and `explain_error` are read-only. `scaffold_route` and `run_typegen` write files, only when invoked.
- The only network access is the documentation fallback in `search_docs`; everything else runs locally against the app and the installed packages.

For the CLI side of these tools, see [CLI](/api/cli). For what `run_check` and `audit` protect, see [Architecture](/architecture).
