---
title: "@moonsjs/core"
description: The config helper and validated config keys, the error model, routing signals, and request-scoped response helpers.
---

`@moonsjs/core` holds the primitives shared by your config, the build, and the server runtime; the other packages re-export the client-safe pieces.

## defineConfig

```ts
function defineConfig<T extends MoonsConfig>(config: T): T;
```

An identity helper that preserves the literal shape of your config, so typegen can derive the app-wide `Ctx` type from `context`. See [Context & Environment](/core-concepts/context-and-environment).

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";

export default defineConfig({
  context: async (req) => ({ requestId: crypto.randomUUID() }),
});
```

An unknown key or wrong shape fails config load with `E_CONFIG_INVALID`. `validateConfig(raw, { file?, projectRoot? })` runs the same check and returns the normalized config with defaults applied.

## Config keys

| Key | Type | Default |
| --- | --- | --- |
| `routesDir` | `string` | `"src/routes"` |
| `apiDir` | `string` | `"src/api"` |
| `context` | `(req: Request) => unknown \| Promise<unknown>` | required |
| `middleware` | `Middleware[]` | `[]` |
| `security.originWhitelist` | `string[]` | `[]` |
| `security.bodyLimitBytes` | `number` | `1_000_000` |
| `security.serverOnlyPackages` | `string[]` | `[]` |
| `security.trustProxy` | `boolean` | `false` |
| `plugins` | `MoonsPlugin[]` | `[]` |
| `headers` | `Record<string, string>` | `{}` |
| `redirects` | `{ from, to, status? }[]` | `[]` |
| `sitemap` | `{ site, exclude? }` | not set |
| `robots` | `{ sitemap?, disallow? }` | not set |
| `hooks` | `{ onRequest?, onResponse?, onError? }` | not set |
| `isr` | `{ storage? }` | not set |
| `logging` | `{ accessLog?, json?, redact? }` | not set |
| `trailingSlash` | `"never" \| "always"` | not set |
| `requestTimeoutMs` | `number` | `30000` |

Behavior notes:

- `requestTimeoutMs` bounds how long a loader, `serverFn`, or API handler may take before the transport answers `504` with `E_REQUEST_TIMEOUT`; `0` disables the limit (the Bun transport's `idleTimeout` is aligned so the framework's `504` wins instead of a silent connection close).
- `middleware` runs globally before the route tree and receives `{ req, ctx, next }` (see [Middleware](/guides/middleware)). `security.bodyLimitBytes` caps RPC request bodies, `security.serverOnlyPackages` extends the built-in list of packages client code may not import, and `security.trustProxy` should only be `true` behind a proxy that overwrites `x-forwarded-*`.
- `redirects` statuses are `301`, `302`, `307`, or `308` (default `301`); `sitemap.exclude` and `robots.disallow` take path prefixes; `plugins` accept `name` plus `addRoute`, `addMiddleware`, `extendContext`, `onStart`, `onReady`, and `onShutdown`.
- `isr.storage` must implement `read(pathname)` and `write(pathname, body)` (see [Prerender & ISR](/guides/prerender-and-isr)); `logging.redact` lists query-param names hidden in access logs.

## MoonsError and error codes

```ts
class MoonsError extends Error {
  readonly code: MoonsErrorCode;
  readonly file?: string;
  readonly line?: number;
  readonly location?: string;
  readonly details: string;
  readonly suggestions: string[];
  format(): string;
}

const MOONS_ERROR_CODES: readonly MoonsErrorCode[];
```

`MoonsError` is the single error type thrown across the framework; `code` is one of the values in `MOONS_ERROR_CODES`. `format()` returns the full `[moons] CODE` block, which is also the error's `message`.

## Error catalog

```ts
interface ErrorCatalogEntry {
  code: MoonsErrorCode;
  trigger: string;
  details: string;
  suggestions: string[];
}

const ERROR_CATALOG: ReadonlyArray<ErrorCatalogEntry>;
function findErrorEntry(code: string): ErrorCatalogEntry | undefined;
```

Every code has a machine-readable entry describing when it triggers and how to fix it; `moons errors --json` and the `explain_error` tool in [@moonsjs/mcp](/api/mcp) are built on it.

## Routing signals

```ts
type RedirectStatus = 301 | 302 | 303 | 307 | 308;

function notFound(): never;
function redirect(to: string, status?: RedirectStatus): never;
```

Both signals are thrown from loaders and `meta` functions: `notFound()` renders the `_404` page with status 404, and `redirect(to, status?)` sends a redirect (default `302`), resolving relative targets against the request URL.

```ts
// src/routes/users/[id].tsx
import { notFound, redirect, type LoaderArgs } from "@moonsjs/react";

export const loader = async ({ params }: LoaderArgs<"/users/[id]">) => {
  if (params.id === "legacy") redirect("/users/u1", 301);
  if (params.id === "u1") return { user: { id: "u1", name: "Ada" } };
  notFound();
};
```

## Response helpers

```ts
function setHeader(name: string, value: string): void;
function appendHeader(name: string, value: string): void;
function setCookie(name: string, value: string, options?: CookieOptions): void;
function deleteCookie(name: string, options?: Pick<CookieOptions, "path" | "domain">): void;
```

| `CookieOptions` | Type | Default |
| --- | --- | --- |
| `maxAge` | `number` (seconds) | not set |
| `expires` | `Date` | not set |
| `path` | `string` | `"/"` |
| `domain` | `string` | not set |
| `secure` | `boolean` | `false` |
| `httpOnly` | `boolean` | `false` |
| `sameSite` | `"lax" \| "strict" \| "none"` | not set |

The helpers are request-scoped: they mutate the response of the request being handled, so call them from a loader, a `*.server.ts` handler, or an API endpoint. Anywhere else they throw `E_RESPONSE_OUTSIDE_REQUEST`; invalid names, CRLF in values, and framing headers such as `content-length` throw `E_RESPONSE_HEADER_INVALID`.

```ts
// src/routes/preferences.tsx
import { setCookie } from "@moonsjs/react";

export const loader = async () => {
  setCookie("theme", "dark", { maxAge: 60 * 60 * 24, httpOnly: true });
  return {};
};
```

## Version and URL policy

```ts
const MOONS_VERSION: string;

function trailingSlashRedirect(pathname: string, policy: "never" | "always"): string | null;
```

`MOONS_VERSION` is the framework version string, also exposed to plugins as `App.version`. `trailingSlashRedirect` powers the `trailingSlash` config: it returns the canonical path when a 308 is required, or `null` for exempt paths — the root, framework paths, and asset paths whose last segment contains a dot.

## Tooling surface

The package also exports the scanners that drive the CLI and build plugin: `scanRoutes` and `routeKeyFromFile` for route discovery, and `generateTypes`, which writes `.moons/routes.d.ts` and `.moons/context.d.ts`.
