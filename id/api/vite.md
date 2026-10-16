# `@moonsjs/vite`

Plugin build/dev + runtime server. Transform zero-trust hidup di
`src/transform.ts`.

Gate **paket server-only** juga hidup di `src/transform.ts` +
`src/server-only.ts` (daftar bawaan `DEFAULT_SERVER_ONLY_PACKAGES`, marker
`"moons": { "serverOnly": true }` di package.json, dan
`security.serverOnlyPackages` dari config): import langsung/dinamis/re-export
dari graph client → `E_FORBIDDEN_SERVER_IMPORT` (type-only dikecualikan);
dijaga CI framework.

**A1 (dev)**: `createRequestHandler` menerima `payloadScan?: PayloadScanOptions`
(hanya diisi runtime dev — `createDevApp(shell, payloadScan)`): peringatan
`[moons] peringatan dev` sekali per label bila payload SSR memuat
`leakTest.canary` atau nilai env mirip-rahasia (nama cocok
SECRET/TOKEN/KEY/…, nilai ≥12 karakter). Production tidak memindai.

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

Tanggung jawab:

1. Load + validasi `moons.config.ts` (startup; `E_CONFIG_INVALID`).
2. Scan route (; konflik → `E_ROUTE_CONFLICT`).
3. Typegen: `.moons/routes.d.ts`, `.moons/context.d.ts`.
4. Scan semua `*.server.{ts,tsx}` → `.moons/fn-registry.json`
 (`"<rel>#<export>" → hash`,).
5. **Transform ** (env client): stub `.server.ts` (schema + hash saja, cache
 `.moons/cache`), rejection import, `E_ENV_IN_CLIENT`,
   validasi export modul route (`E_ROUTE_EXPORT_INVALID`); env ssr: injeksi meta
   `__hash/__file/__line/__exportName`.
6. Verifikasi `generateBundle` (client): modul `.server` wajib stub + scan
   canary `leakTest.canary`.
7. Dev server: SSR middleware (`/_moons/*` + halaman), HMR route.
8. Build: `vite build` → `dist/client/**`; `vite build --ssr` →
 `dist/server/index.js` (; entry di-generate `.moons/server-entry.ts`,
   eager import semua file ber-`serverFn`).

Hook yang dipakai: `config`, `configResolved`, `buildStart`, `resolveId`,
`load`, `transform`, `generateBundle`, `configureServer`, `handleHotUpdate`.

## Virtual module (— id di-resolve `\0`-prefix)

| Id | Isi |
|---|---|
| `virtual:moons/routes` | `routes: RouteDefinition[]`, `clientManifest`, `loadRoute` (import() per file) |
| `virtual:moons/config` | re-export `moons.config.ts` + `validateConfig` |
| `virtual:moons/client-entry` | manifest untuk `@moonsjs/react/client` |
| `virtual:moons/server-entry` | handler dev (factory shell) / entry build |

## Runtime — `@moonsjs/vite/server`

| Export | Fungsi |
|---|---|
| `createRequestHandler(options)` | Handler `Request → Response`: health → RPC → route HTML; opsi: `routes`, `config`, `routesDir`, `loadRoute`, `shell` |
| `createFileShell()` / `createDevShell()` | Shell prod (`dist/client/index.html`) / dev (`transformIndexHtml`) |
| `injectShell(template, markup, payload)` | Inject `#root` + payload (`ROOT_PLACEHOLDER`, `DEFAULT_TEMPLATE`) |
| `startNodeServer(handler, options)` | Produksi `node:http`: static + handler + log port; opsi `port`, `clientDir`, `handleSignals`, `shutdownTimeoutMs` |
| `installGracefulShutdown(server, options)` | SIGTERM/SIGINT → drain → exit 0; timeout → exit 1 |
| `createTestServer(options, baseUrl?)` | Utility in-process tanpa port |
| `resolveStaticFile(clientDir, pathname)` | Static anti path-traversal |
| `toWebRequest` / `sendNodeResponse` | Konversi Node ↔ Web (body diteruskan) |
| `installDevMiddleware(server, { templatePath })` | Middleware SSR dev |

Endpoint runtime: HTML semua route · static `dist/client/**` · RPC
`POST /_moons/fn/<hash>` · `/_moons/health` → `{"ok": true}`.

## Lintasan kebocoran (tiga lapis)

1. Transform + rejection saat build/dev.
2. Verifikasi `generateBundle` (module `.server` wajib stub; canary opsional).
3. Leak test CI — dijalankan juga oleh fixture lewat `leakTest.canary`.
