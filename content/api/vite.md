---
title: "@moonsjs/vite"
description: The Vite plugin that scans routes, generates types, enforces the server/client boundary, and verifies the client bundle.
---

`@moonsjs/vite` is the build and dev plugin behind `moons dev`, `moons build`, and `moons check`. It wires route scanning, type generation, the zero-trust transform, and the leak canary into a normal Vite pipeline.

## moons(options)

```ts
import moons from "@moonsjs/vite";

function moons(options?: {
  configPath?: string;
  leakTest?: { canary?: string };
  projectRoot?: string;
}): Plugin;
```

| Option | Type | Default |
| --- | --- | --- |
| `configPath` | `string` | `"moons.config.ts"` |
| `leakTest.canary` | `string` | not set |
| `projectRoot` | `string` | the Vite root |

```ts
// vite.config.ts
import { defineConfig } from "vite";
import moons from "@moonsjs/vite";

export default defineConfig({
  plugins: [moons({ leakTest: { canary: "MOONS_APP_CANARY_4f1c" } })],
});
```

## What the plugin enforces

- **Config load.** `moons.config.ts` is loaded and validated; a missing or malformed config stops startup with `E_CONFIG_INVALID`.
- **Route scan and typegen.** Routes are scanned on startup and on file changes, and `.moons/routes.d.ts`, `.moons/context.d.ts`, and `.moons/fn-registry.json` are regenerated automatically.
- **Stub transform (client build).** Every `*.server.ts(x)` module becomes an RPC stub carrying the signature, schemas, and hash; the handler body is removed from the client graph.
- **Bundle verification.** After the client build, every remaining `.server` module must have passed through the transform. When `leakTest.canary` is set, the bundle is scanned for that string, and a hit stops the build.

The full model is in [Zero-Trust Model](/core-concepts/zero-trust) and [Architecture](/architecture). At a glance, the failures you can hit:

| Situation | Error |
| --- | --- |
| Importing a value that is not a `serverFn` from a `*.server.ts` module | `E_SERVER_IMPORT_IN_CLIENT` |
| Importing `node:*`/`bun:*`, a server-only package, or the config from client code | `E_FORBIDDEN_SERVER_IMPORT` |
| Calling `env()` in client code | `E_ENV_IN_CLIENT` |
| A `serverFn` schema referencing a local declaration or a value from another server file | `E_SCHEMA_LOCAL_REF` / `E_SCHEMA_SERVER_REF` |
| A route module exporting outside its contract (a page takes `default`, `loader`, `meta`) | `E_ROUTE_EXPORT_INVALID` |
| An `src/api` module exporting something other than a method handler | `E_API_HANDLER_INVALID` |
| The canary string appearing anywhere in `dist/client` | build stopped by leak verification |

Route and API scans run on startup and again on every relevant file change, so the dev tools and the next build always describe the current tree.

## Dev server

Under `moons dev`, the plugin runs Vite's dev server with SSR middleware and hot reloading for routes and API modules. It serves a dev-only overview at `/__moons/devtools`:

- the scanned route table (path, kind, file),
- the `src/api` endpoints,
- the `serverFn` registry (hash, export, file),
- whether the payload scan has a canary configured.

The overview is rendered fresh on every request, is never part of production builds, and the plugin logs its URL when the server starts.

## Builds

The plugin configures two Vite builds. The client build writes `dist/client` — assets plus any prerendered HTML. The server build writes `dist/server/index.js` and `dist/server/prerender.js` next to lazily loaded chunks. Generated entries live in `.moons/` and eagerly import every module that declares a `serverFn`, so the registry is complete at startup.

`moons build` runs both builds and then executes the prerender entry; a route contract error during prerender fails the command. The server output imports `@moonsjs/vite/server`, the runtime subpath that provides the request handler and the Node server used in production.

## Server transports

`moons start` loads `dist/server/index.js`, which picks its HTTP host with `startServer`:

- **Bun runtime** → `Bun.serve` (`startBunServer`).
- **Node runtime** → `node:http` (`startNodeServer`).
- `MOONS_SERVER=bun|node` overrides the choice; `bun` outside Bun logs a warning and falls back to Node.

Both transports share one implementation of the observable behavior: static files and the prerender manifest, `isr.storage` with the `dist/client` fallback, weak ETags and `304`, gzip for text assets, trailing-slash `308`s, the RPC body limit (`413` with `E_RPC_BODY_TOO_LARGE`), default security headers, `Cache-Control: immutable` for `/assets/*`, trusted client IP via `security.trustProxy`, access logs, and the graceful SIGTERM drain. The `dev-parity` end-to-end suite runs the same assertion matrix against `moons dev`, `Bun.serve`, and `MOONS_SERVER=node`, so the two hosts cannot drift silently.

On a trivial handler `Bun.serve` is measurably faster than `node:http`; on SSR workloads both are bound by your render code, and the framework adds no measurable difference.

## Testing entry

The `@moonsjs/vite/testing` subpath exposes the helpers behind `moons test`:

```ts
import {
  moonsTestPlugin,
  registerMoonsTestPlugin,
  transformServerModuleForTest,
} from "@moonsjs/vite/testing";

function transformServerModuleForTest(file: string, projectRoot?: string): string;
function moonsTestPlugin(projectRoot?: string): BunPlugin;
function registerMoonsTestPlugin(projectRoot?: string): void;
```

`transformServerModuleForTest` returns a `*.server.ts(x)` source with the transform-generated `serverFn` metadata (`__hash`, `__file`, `__line`, `__exportName`) injected — the same injection the build performs. `moonsTestPlugin` is a Bun plugin that applies it on load, and `registerMoonsTestPlugin` registers it for the current process. The preload `moons test` passes to `bun test` is published at `@moonsjs/vite/testing/preload`; it registers the plugin and sets `globalThis.__moonsTestPreload`, so a test can detect the preloaded run. See [Testing](/guides/testing) for the workflow.

## Requirements

The peer dependency is Vite `^8.3.4`. The plugin runs with `enforce: "pre"` so the transform sees modules before any other plugin. The dev server and build toolchain run on Bun, while the generated server output runs on Bun and Node — the runtime subpath uses only `node:*` APIs.
