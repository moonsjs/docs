# `@moonsjs/core`

Router, pemindaian/typegen route, config, error, serialisasi, dan runner
loader/middleware. Semua API di bawah diekspor dari `@moonsjs/core` kecuali
subpath `@moonsjs/core/serialize`.

## Config

```ts
function defineConfig(config: MoonsConfig): MoonsConfig;
```

```ts
interface MoonsConfig {
  routesDir: string;                 // wajib di tipe; default runtime "src/routes"
  context: (req: Request) => Promise<unknown> | unknown;
  middleware?: Middleware[];         // default []
  security?: {
    originWhitelist?: string[];      // default []
    bodyLimitBytes?: number;         // default 1_000_000
    serverOnlyPackages?: string[];   // default [] — tambahan gate paket server-only
  };
  plugins?: MoonsPlugin[];           // divalidasi ketat; lifecycle dieksekusi
}

interface MiddlewareArgs { req: Request; ctx: Ctx; next: () => Promise<Response>; }
type Middleware = (args: MiddlewareArgs) => Promise<Response>;
```

## Deploy statis & runtime

Key opsional yang menghasilkan berkas produksi dan perilaku runtime:

- `headers` — header respons tambahan; dipasang runtime (bila belum ada) dan ditulis ke `_headers` saat build statis.
- `redirects` — `{ from, to, status? }` (301/302/307/308); dilayani runtime dan ditulis ke `_redirects`. Dilewati saat prerender.
- `sitemap` — `{ site, exclude? }`; menulis `sitemap.xml` dari path yang benar-benar di-prerender.
- `robots` — `{ sitemap?, disallow? }`; menulis `robots.txt`.
- `hooks` — `onRequest`, `onResponse` (boleh mengembalikan `Response` pengganti), `onError`.
- `isr` — `{ storage? }`; `PrerenderStorage` bersama untuk file prerender (ISR multi-instance; lihat halaman Vite).
- `logging` — `{ accessLog?, json?, redact? }`; log akses runtime terstruktur (JSON default; `moons dev` menulis `.moons/dev.log` terkelola CLI), `redact` = daftar query-param yang nilainya menjadi `[redacted]`. Default: senyap.

```ts
export default defineConfig({
  context: async () => ({}),
  headers: { "x-frame-options": "DENY" },
  redirects: [{ from: "/lama", to: "/baru" }],
  sitemap: { site: "https://example.com" },
  robots: { disallow: ["/internal"] },
  hooks: {
    onResponse: (response) => {
      response.headers.set("x-app", "docs");
    },
  },
});
```

Semua nilai divalidasi ketat saat load; salah ketik menggagalkan build dengan `E_CONFIG_INVALID`.

## Paket server-only 

Gate build di graph client (route/client/shared, transitif) — import langsung,
`import()` dinamis, `export *`/re-export → `E_FORBIDDEN_SERVER_IMPORT`.

Paket dianggap server-only bila: (1) ada di **daftar bawaan**, (2) ada di
`security.serverOnlyPackages`, atau (3) `package.json`-nya memuat
`"moons": { "serverOnly": true }` (marker). Pencocokan lewat **nama paket hasil
resolve** (subpath/alias/tsconfig-paths/symlink/workspace ikut tertangkap);
import **type-only** dikecualikan; `*.server.ts` tidak terpengaruh.

Daftar bawaan (minimum; tidak dapat dihapus app):

```txt
pg, postgres, mysql, mysql2, sqlite3, better-sqlite3, drizzle-orm,
@prisma/client, prisma, mongodb, mongoose, redis, ioredis, bcrypt, bcryptjs,
argon2, jsonwebtoken, nodemailer, sharp, execa, cross-spawn, dotenv, knex,
typeorm, sequelize, @libsql/client
```

Konstanta runtime: `DEFAULT_SERVER_ONLY_PACKAGES` (`@moonsjs/vite` — dipakai
`transform.ts`/plugin); katalog error: `moons errors --json`.

## Helper respons (D.2)

```ts
// @moonsjs/core/response (client-safe) — re-export: @moonsjs/react & @moonsjs/server
setHeader(name, value); appendHeader(name, value);
setCookie(name, value, options?); deleteCookie(name, options?);
```

Request-scoped (AsyncLocalStorage di `@moonsjs/server`:
`runWithResponseCollector`/`takeResponseMutations`); runtime
`@moonsjs/vite/server` menerapkan ke respons akhir (HTML, RPC, API, error).
Error: `E_RESPONSE_HEADER_INVALID`, `E_RESPONSE_OUTSIDE_REQUEST`.

## Endpoint API (D.1)

`validateConfig(raw, { file?, projectRoot? })` memvalidasi objek config
(key tak dikenal, `context` bukan fungsi, `routesDir` tidak ada bila
`projectRoot` diisi, dsb.) — gagal → `E_CONFIG_INVALID` dengan format 
Mengembalikan config ternormalisasi (default diterapkan).

## Route

```ts
function scanRoutes(routesDir: string): RouteDefinition[];      // scan file route; konflik → E_ROUTE_CONFLICT
function resolveRoute(url: string, routes: RouteDefinition[]): ResolvedRoute | null;
function findLayouts(page: RouteDefinition, routes: RouteDefinition[]): RouteDefinition[];
function routeKeyFromFile(routesDir: string, file: string): string; // "users/[id]"
```

```ts
interface RouteDefinition {
  path: string;                                  // "/users/:id", catch-all = "*"
  file: string;                                  // absolute posix
  kind: "page" | "layout" | "error" | "404";
  params: string[];
}

interface ResolvedRoute { route: RouteDefinition; layouts: RouteDefinition[]; params: Record<string, string>; }
```

Aturan scan/file: `(group)` tidak masuk URL; `[param]`, `[...rest]`
(wajib segmen terakhir); `_layout` untuk direktori + turunannya; `_error`/`_404`
root-only; file `_*` lain diabaikan. Catch-all membutuhkan minimal satu segmen.
Presedensi: static > dynamic > catch-all per segmen.

## Typegen 

```ts
function generateTypes(args: { routesDir: string; configPath: string; outDir: string }): Promise<void>;
```

Menulis `.moons/routes.d.ts` (augmentasi `RouteMap` untuk `@moonsjs/react`) dan
`.moons/context.d.ts` (global `Ctx` + `export type Ctx`). File `routes.d.ts`
diakhiri `export {}` agar augmentasi berlaku.

## Hash serverFn 

```ts
function computeFnHash(projectRoot: string, file: string, exportName: string): string; // sha256 16 hex
function fnRegistryKey(projectRoot: string, file: string, exportName: string): string; // "src/server/x.server.ts#fn"
```

## Serialisasi — subpath `@moonsjs/core/serialize`

```ts
interface SsrPayload { key: string; params: Record<string, string>; data: Record<string, unknown>; error?: unknown; }
function encodeSsrPayload(payload: SsrPayload): string;  // devalue → JSON.stringify → escape HTML-safe
function decodeSsrPayload(text: string): SsrPayload;

interface SerializedError { __moons_error: true; name: string; message: string; stack?: string; }
function serializeError(error: unknown): SerializedError;  // devalue tidak mendukung Error
function reviveError(data: SerializedError): Error;
```

Subpath ini browser-safe (tanpa `node:*`) dan dipakai client + server.

## Runner

```ts
function runLoaders(
  entries: ReadonlyArray<{ file: string; module: RouteModule }>,
  args: { params: Record<string, string>; ctx: Ctx; req: Request },
): Promise<Record<string, unknown>>;      // paralel; loader mengembalikan Response → E_INTERNAL

function composeMiddleware(
  middleware: ReadonlyArray<Middleware>,
  ctx: Ctx,
  final: () => Promise<Response>,
): (req: Request) => Promise<Response>;   // next() wajib tepat sekali → E_INTERNAL
```

## Error 

```ts
class MoonsError extends Error {
  readonly code: MoonsErrorCode; readonly file?: string; readonly line?: number;
  readonly annotation?: string;   // mis. "(getUser)"
  readonly location?: string;     // mis. "POST /_moons/fn/<hash>"
  readonly relatedFiles: string[]; readonly details: string; readonly suggestions: string[];
  format(): string;               // teks error standar (juga menjadi `message`)
}
const MOONS_ERROR_CODES: readonly MoonsErrorCode[];  // 22 kode
```
