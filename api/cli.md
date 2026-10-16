# `@moonsjs/cli`

The `moons` bin. Run it with `bunx --package @moonsjs/cli moons <command>`
(or `moons` when the CLI is installed as a dev dependency).

## Commands

| Command | Behavior |
|---|---|
| `moons create <name>` | Scaffold from the bundled template: copy (excluding `node_modules/dist/.moons/.git`), rewrite `name` in package.json, write `.gitignore`, run `bun install` (skipped when the target is a workspace member), print instructions. Non-empty target → error |
| `moons dev` | Vite dev server (HMR + SSR), port from `PORT` env (default 3000), `--strictPort`; SIGTERM/SIGINT are forwarded to the Vite process. |
| `moons build` | `vite build` → `vite build --ssr` (the vite bin is resolved upward from cwd, run with the current runtime). Output `dist/client/**` + `dist/server/index.js`; the canary leak check runs inside the build when `leakTest.canary` is set. |
| `moons start` | Loads `dist/server/index.js` in-process; PORT/3000; HTML+static+RPC+health; SIGTERM → drain. |
| `moons typegen` | `loadConfigFromFile` + `validateConfig` + `generateTypes` → `.moons/*.d.ts`. |
| `moons help` / `--help` | Usage. |

Exit codes: `0` success; `1` error (formatted for `MoonsError`; stack for
unexpected errors); `dev` forwards the Vite process exit code.

## `moons audit`

`moons audit [--json] [--strict] [--canary <value>]` is a read-only security pass:

- `rpc-inventory` — every `serverFn` endpoint (file#export) — the surface anyone can call.
- `env-access` — which `env()` keys each server file reads.
- `cookie-flags` — warns about `setCookie()` calls missing `HttpOnly`/`Secure`/`SameSite`.
- `headers-csp` — warns when `headers` has no CSP, or one with `unsafe-inline`/`unsafe-eval`.
- `deploy-kit` — summary of configured headers/redirects/sitemap/robots.
- `dist-scan` — scans `dist/client/**` for secret-like env values and your canary; **fails** on a hit.

Exit code is `1` on any failure (`--strict` also fails on warnings). With `--json`, stdout is a single JSON document and stderr stays silent — safe for CI and agents.

## Programmatic exports

```ts
runCli(argv, cwd?): Promise<number>;
parseCommand(argv): { command: CliCommand; args: string[] } | null;
CLI_COMMANDS: readonly CliCommand[];          // create|dev|build|start|typegen

scaffoldProject({ targetDir, templateDir, name }): { packageName };
detectWorkspaceRoot(targetDir): string | null;
matchesWorkspacePattern(relativePath, pattern): boolean;
resolveViteBin(cwd): string;
repoRoot: string; templateDir: string;        // v1: berbasis lokasi source repo
```

## Limitations

- `create` inside a workspace skips `bun install` (dependencies come from the workspace).
- Target directories must be empty; existing files are never overwritten.
