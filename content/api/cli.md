---
title: CLI
description: The moons command line for scaffolding, the dev/build/start loop, verification with check and test, and JSON introspection with routes, fns, errors, and audit.
---

The `moons` command is the single entry point for scaffolding, developing, verifying, and shipping a Moons app. Run it directly, or install it as a dev dependency of the project — `moons create` adds it and wires the `bun run dev/build/start/check` scripts to the local copy.

```bash
bunx --package @moonsjs/cli moons create my-app
```

`--package` is required because the binary is named `moons` while the package is `@moonsjs/cli`.

## Commands

| Command | What it does |
| --- | --- |
| `moons create <name>` | Scaffolds a project from the bundled template, rewrites `package.json`, and runs `bun install` (skipped inside a workspace). The target must be new or empty. |
| `moons dev` | Starts the Vite dev server with SSR and HMR. The port comes from `PORT` (default 3000) and is taken strictly. |
| `moons build` | Builds the client, the server, and prerendered pages; output lands in `dist/client` and `dist/server`. |
| `moons start` | Serves the build output by loading `dist/server/index.js`, with `NODE_ENV=production` set when unset. |
| `moons typegen` | Regenerates `.moons/routes.d.ts` and `.moons/context.d.ts`. |
| `moons routes [--json]` | Prints the route table from a scan, no build needed; `--kind=<page\|layout\|error\|404\|api>` filters it. |
| `moons fns [--json]` | Prints the `serverFn` registry from a `*.server.ts` scan. |
| `moons check [--json]` | Runs the verification pipeline: typegen → `tsc --noEmit` → client build → server build → prerender. |
| `moons test [args…]` | Runs `bun test` with the Moons server transform preloaded; extra arguments go to Bun. |
| `moons errors [--json]` | Prints the machine-readable error catalog. |
| `moons audit [--json]` | Runs the security audit over sources and `dist/client`. |

## Dev, build, and start

- `dev` forwards `SIGTERM`/`SIGINT` to the Vite process and mirrors its exit code. It also writes a CLI-managed log to `.moons/dev.log`.
- `build` runs three stages: the client bundle, the server bundle, and the prerender entry (`dist/server/prerender.js`). A zero-trust rejection, a canary hit, or a prerender contract error stops the command with a non-zero exit code. The canary check is active when `leakTest.canary` is set in `vite.config.ts`.
- `start` loads `dist/server/index.js` in-process; it listens on `PORT` (default 3000) and drains in-flight requests on `SIGTERM`. See [Deployment](/guides/deployment).

## Testing

`moons test [args…]` runs `bun test` with a preload that annotates every `*.server.ts(x)` module with the same `serverFn` metadata the build injects (`__hash`, `__file`, `__line`, `__exportName`), so tests can import route modules that call `serverFn`. Arguments are forwarded to Bun unchanged: a bare argument is a test-name filter, while a path such as `moons test ./test/example.test.ts` runs that file. The command exits with Bun's test exit code — `0` when every test passes, non-zero otherwise. See [Testing](/guides/testing) for the test server and API-route options.

## The check pipeline

`moons check` answers whether the app is still sound, in dependency order:

1. **typegen** — regenerate `.moons/*.d.ts`.
2. **TypeScript** — `tsc --noEmit` using the project's own `node_modules`.
3. **client build** — the transform, import rejections, and the canary scan.
4. **server build** — the SSR and server bundle.
5. **prerender** — static routes, guarded against leaks in their output.

The chain stops at the first failing step. With `--json` it prints a document with `ok` and a `steps` array, where each step carries `name`, `ok`, `durationMs`, and optionally `code` and `message`. The exit code is `0` only when every step passes.

## JSON introspection

`routes --json` prints `{ routesDir, count, routes }`. Each entry carries `path`, `file`, `key`, `kind`, and `params`, plus `layouts` and `prerender` for pages and `methods` for API endpoints:

```json
{
  "routesDir": "src/routes",
  "count": 1,
  "routes": [
    {
      "path": "/blog/:slug",
      "file": "src/routes/blog/[slug].tsx",
      "key": "blog/[slug]",
      "kind": "page",
      "params": ["slug"],
      "layouts": ["_layout"]
    }
  ]
}
```

`fns --json` prints `{ count, fns, registry, serverFiles }`. Each `fns` entry has `key` (`file#export`), `hash`, `file`, `export`, and `line`; `registry` maps every key to its hash, and `serverFiles` lists every scanned `*.server.ts(x)` file — including files that declare no `serverFn`, which is useful for spotting server-only modules.

`errors --json` prints `{ moonsVersion, count, errors }` with `code`, `trigger`, `details`, and `suggestions` per entry. The same data powers error explanations in [@moonsjs/mcp](/api/mcp).

## Audit

`moons audit` is a read-only pass over the project:

| Check | What it looks at |
| --- | --- |
| `rpc-inventory` | Every registered `serverFn` — the callable surface. |
| `env-access` | Which `env()` keys each server file reads. |
| `cookie-flags` | Warns about `setCookie()` calls missing `HttpOnly`, `Secure`, or `SameSite`. |
| `headers-csp` | Warns when no CSP is configured, or one contains `unsafe-inline`/`unsafe-eval`. |
| `deploy-kit` | Summarizes configured headers, redirects, sitemap, and robots. |
| `dist-scan` | Scans `dist/client` for secret-looking environment values and your canary; a hit fails the audit. |

`--json` prints a document with `ok`, a `counts` object (`pass`, `warn`, `fail`), and the `checks` array. `--strict` also fails on warnings, and `--canary <value>` adds your app's canary string to the scan.

## Exit codes

`0` means success. `1` covers command errors — a formatted `[moons]` block for known failures, a stack trace for unexpected ones. `check` and `audit` return `1` when a step fails or a check fails, and `audit --strict` also returns `1` on warnings. `test` returns Bun's test exit code, and `dev` forwards the Vite process's exit code. `moons help` prints the command list.
