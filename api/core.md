# `@moonsjs/core`

Router, route scan/typegen, config, errors, serialization, and the
loader/middleware runner. All APIs below are exported from `@moonsjs/core`
except the `@moonsjs/core/serialize` subpath.

## Config

```ts
function defineConfig(config: MoonsConfig): MoonsConfig;
```

```ts
interface MoonsConfig {
  routesDir: string;                 // required in the type; runtime default "src/routes"
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

## Static deploy & runtime

Optional keys that produce production files and runtime behavior:

- `headers` — extra response headers; applied at runtime (when not already set) and written to `_headers` on a static build.
- `redirects` — `{ from, to, status? }` (301/302/307/308); served at runtime and written to `_redirects`. Skipped while prerendering.
- `sitemap` — `{ site, exclude? }`; emits `sitemap.xml` from the paths that were actually prerendered.
- `robots` — `{ sitemap?, disallow? }`; emits `robots.txt`.
- `hooks` — `onRequest`, `onResponse` (may return a replacement `Response`), `onError`.
- `isr` — `{ storage? }`; a shared `PrerenderStorage` for prerendered files (multi-instance ISR; see the Vite page).
- `logging` — `{ accessLog?, json?, redact? }`; structured runtime access logs (JSON by default, `moons dev` writes a CLI-managed `.moons/dev.log`), with `redact` listing query params whose values become `[redacted]`. Default: silent.

```ts
export default defineConfig({
  context: async () => ({}),
  headers: { "x-frame-options": "DENY" },
  redirects: [{ from: "/old", to: "/new" }],
  sitemap: { site: "https://example.com" },
  robots: { disallow: ["/internal"] },
  hooks: {
    onResponse: (response) => {
      response.headers.set("x-app", "docs");
    },
  },
});
```

Every value is validated strictly at load time; a typo fails the build with `E_CONFIG_INVALID`.

## Server-only packages

Build gate on the client graph (route/client/shared, transitively) — direct
import, dynamic `import()`, `export *`/re-exports → `E_FORBIDDEN_SERVER_IMPORT`.

A package counts as server-only when: (1) it is in the **built-in list**, (2) it
is in `security.serverOnlyPackages`, or (3) its `package.json` carries
`"moons": { "serverOnly": true }` (marker). Matching uses the **resolved package
name** (subpaths/aliases/tsconfig-paths/symlinks/workspaces are all caught);
**type-only** imports are exempt; `*.server.ts` is unaffected.

Built-in list (minimum; apps cannot remove it):

```txt
pg, postgres, mysql, mysql2, sqlite3, better-sqlite3, drizzle-orm,
@prisma/client, prisma, mongodb, mongoose, redis, ioredis, bcrypt, bcryptjs,
argon2, jsonwebtoken, nodemailer, sharp, execa, cross-spawn, dotenv, knex,
typeorm, sequelize, @libsql/client
```

Runtime constant: `DEFAULT_SERVER_ONLY_PACKAGES` (`@moonsjs/vite` — used by
`transform.ts`/the plugin); error catalog: `moons errors --json`.

## Response helpers (D.2)

```ts
// @moonsjs/core/response (client-safe) — re-export: @moonsjs/react & @moonsjs/server
setHeader(name, value); appendHeader(name, value);
setCookie(name, value, options?); deleteCookie(name, options?);
```

Request-scoped (AsyncLocalStorage in `@moonsjs/server`:
`runWithResponseCollector`/`takeResponseMutations`); the
`@moonsjs/vite/server` runtime applies them to the final response (HTML, RPC,
API, errors). Errors: `E_RESPONSE_HEADER_INVALID`, `E_RESPONSE_OUTSIDE_REQUEST`.

## API endpoints (D.1)

`validateConfig(raw, { file?, projectRoot? })` validates the config object
(unknown keys, `context` not a function, missing `routesDir` when `projectRoot`
is set, etc.) — failure → `E_CONFIG_INVALID` in the standard error format.
Returns the normalized config (defaults applied).

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

Scan/file rules: `(group)` does not appear in the URL; `[param]`, `[...rest]`
(must be the last segment); `_layout` for a directory + its subtree;
`_error`/`_404` root-only; other `_*` files are ignored. A catch-all requires
at least one segment. Precedence: static > dynamic > catch-all per segment.

## Typegen

```ts
function generateTypes(args: { routesDir: string; configPath: string; outDir: string }): Promise<void>;
```

Writes `.moons/routes.d.ts` (augments `RouteMap` for `@moonsjs/react`) and
`.moons/context.d.ts` (global `Ctx` + `export type Ctx`). The `routes.d.ts` file
ends with `export {}` so the augmentation takes effect.

## serverFn hash

```ts
function computeFnHash(projectRoot: string, file: string, exportName: string): string; // sha256 16 hex
function fnRegistryKey(projectRoot: string, file: string, exportName: string): string; // "src/server/x.server.ts#fn"
```

## Serialization — the `@moonsjs/core/serialize` subpath

```ts
interface SsrPayload { key: string; params: Record<string, string>; data: Record<string, unknown>; error?: unknown; }
function encodeSsrPayload(payload: SsrPayload): string;  // devalue → JSON.stringify → escape HTML-safe
function decodeSsrPayload(text: string): SsrPayload;

interface SerializedError { __moons_error: true; name: string; message: string; stack?: string; }
function serializeError(error: unknown): SerializedError;  // devalue does not support Error
function reviveError(data: SerializedError): Error;
```

This subpath is browser-safe (no `node:*`) and is used by both client and server.

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
): (req: Request) => Promise<Response>;   // next() exactly once → E_INTERNAL
```

## Errors

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
