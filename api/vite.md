# `@moonsjs/vite`

Build/dev plugin + server runtime. The zero-trust transform lives in
`src/transform.ts` — see also `../decisions/0002-m1-ssr.md` and
`../decisions/0003-m2-zero-trust.md`.

The **server-only package** gate also lives in `src/transform.ts` +
`src/server-only.ts` (the built-in `DEFAULT_SERVER_ONLY_PACKAGES` list, the
`"moons": { "serverOnly": true }` marker in package.json, and
`security.serverOnlyPackages` from the config): direct/dynamic/re-export imports
from the client graph → `E_FORBIDDEN_SERVER_IMPORT` (type-only imports are
exempt); enforced by `scripts/m2/test-server-only-import.sh`.

**A1 (dev)**: `createRequestHandler` accepts `payloadScan?: PayloadScanOptions`
(filled only by the dev runtime — `createDevApp(shell, payloadScan)`): a
`[moons] peringatan dev` warning once per label when the SSR payload contains
`leakTest.canary` or a secret-looking env value (name matches
SECRET/TOKEN/KEY/…, value ≥12 characters). Production never scans.

## Plugin — `@moonsjs/vite`

```ts
import moons from "@moonsjs/vite";

export default defineConfig({
  plugins: [moons({
    configPath: "moons.config.ts",          // default
    leakTest: { canary: "MOONS_..." },      // opsional (CI leak test)
    projectRoot: undefined,                 // default: root Vite
  })],
});
```

Responsibilities:

1. Load + validate `moons.config.ts` (startup; `E_CONFIG_INVALID`).
2. Scan routes (conflicts → `E_ROUTE_CONFLICT`).
3. Typegen: `.moons/routes.d.ts`, `.moons/context.d.ts`.
4. Scan every `*.server.{ts,tsx}` → `.moons/fn-registry.json`
  (`"<rel>#<export>" → hash`).
5. **Transform** (client env): `.server.ts` stub (schema + hash only, cached in
 `.moons/cache`), import rejection, `E_ENV_IN_CLIENT`,
   route module export validation (`E_ROUTE_EXPORT_INVALID`); ssr env: meta
   injection `__hash/__file/__line/__exportName`.
6. `generateBundle` verification (client): `.server` modules must be stubs + scan
   for the `leakTest.canary` canary.
7. Dev server: SSR middleware (`/_moons/*` + pages), route HMR.
8. Build: `vite build` → `dist/client/**`; `vite build --ssr` →
 `dist/server/index.js` (the entry is generated as `.moons/server-entry.ts`,
   eagerly importing every file with a `serverFn`).

Hooks used: `config`, `configResolved`, `buildStart`, `resolveId`,
`load`, `transform`, `generateBundle`, `configureServer`, `handleHotUpdate`.

## Virtual modules (ids resolved by the `\0` prefix)

| Id | Contents |
|---|---|
| `virtual:moons/routes` | `routes: RouteDefinition[]`, `clientManifest`, `loadRoute` (per-file import()) |
| `virtual:moons/config` | re-export `moons.config.ts` + `validateConfig` |
| `virtual:moons/client-entry` | manifest for `@moonsjs/react/client` |
| `virtual:moons/server-entry` | dev handler (shell factory) / build entry |

## Runtime — `@moonsjs/vite/server`

| Export | Function |
|---|---|
| `createRequestHandler(options)` | `Request → Response` handler: health → RPC → HTML routes; options: `routes`, `config`, `routesDir`, `loadRoute`, `shell` |
| `createFileShell()` / `createDevShell()` | Prod shell (`dist/client/index.html`) / dev shell (`transformIndexHtml`) |
| `injectShell(template, markup, payload)` | Inject `#root` + payload (`ROOT_PLACEHOLDER`, `DEFAULT_TEMPLATE`) |
| `startNodeServer(handler, options)` | Production `node:http`: static + handler + port log; options `port`, `clientDir`, `handleSignals`, `shutdownTimeoutMs` |
| `installGracefulShutdown(server, options)` | SIGTERM/SIGINT → drain → exit 0; timeout → exit 1 |
| `createTestServer(options, baseUrl?)` | In-process utility with no port |
| `resolveStaticFile(clientDir, pathname)` | Path-traversal-safe static file resolution |
| `toWebRequest` / `sendNodeResponse` | Node ↔ Web conversion (body is streamed through) |
| `installDevMiddleware(server, { templatePath })` | Dev SSR middleware |

Runtime endpoints: HTML for every route · static `dist/client/**` · RPC
`POST /_moons/fn/<hash>` · `/_moons/health` → `{"ok": true}`.

## Leak paths (three layers)

1. Transform + rejection at build/dev time.
2. `generateBundle` verification (`.server` modules must be stubs; canary optional).
3. CI leak test `scripts/m2/test-leak.sh` — also run by the
   fixture via `leakTest.canary`.
