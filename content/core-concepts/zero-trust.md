---
title: Zero-Trust Model
description: What the zero-trust guarantee covers, what stays public, and what remains your responsibility.
---

Moons is built around one guarantee: server code cannot leak into the client bundle, and any attempt fails the build instead of merely being flagged as risky. This page explains what that means in practice, what is enforced for you, and the parts that stay your responsibility.

## The guarantee

Every module that ends up in the client bundle passes through a build-time transform. Files that match the server-only contract — `*.server.ts` and `*.server.tsx` — are replaced by RPC stubs. A stub keeps the function signature, the input/output schemas, and a stable hash; the handler body never reaches the browser.

Anything that tries to move server code across the boundary fails the build with a `[moons]` error that names the file and line. It is not a warning, and there is no flag that turns it off.

## What happens when you leak server code

Two failures cover most real mistakes.

Importing a server-only module from client code — for example `node:fs` in a route file:

```bash
[moons] E_FORBIDDEN_SERVER_IMPORT

src/routes/report.tsx:1
  importing `node:fs` in a client module

Server-only modules may only be imported from *.server.ts.

Suggestion:
  1. Move the operation into a serverFn, or
  2. Remove the import
```

Importing a value that is not a `serverFn` from a `*.server.ts` file:

```bash
[moons] E_SERVER_IMPORT_IN_CLIENT

src/routes/dashboard.tsx:2
  importing `db` from src/server/db.server.ts

Server code must not appear in the client.
Only `serverFn` may cross.

Suggestion:
  1. Create a server function that returns the data you need, or
  2. If the value is genuinely public, redefine the constant in a client-safe module (never move secret values)
```

Both snippets have the same shape as real build output: the error code, the `file:line` location, a one-line description, details, and numbered suggestions.

## What remains public

The boundary is precise, not magical. These values cross to the browser by design:

- **Loader data.** Loaders run on the server, but their return value is embedded in the HTML payload so hydration can reuse it without a second request. Never return secrets from a loader — anyone can read the page source.
- **serverFn schemas.** The client stub validates input before the request and output after the response, so both schemas travel with the client bundle. Treat schema literals and messages as public, and put sensitive checks in the handler, not in the schema.
- **Client code.** Everything imported from a route file, component, or shared module runs in the browser by definition. It is not protected by the transform; the transform only guarantees that server-only code stays out.

## What is guarded

- **`src/server/**`** — importing a value from this directory in a client module fails the build. The whole directory is server-only, not just the files named `*.server.ts`.
- **`moons.config.ts`** — the config holds your `context` function and middleware, so it is server-only too. Importing it from client code fails the build.
- **The `*.server.ts` naming contract** — only named `serverFn` exports cross the boundary. Default exports, namespace imports, and plain values are rejected, including through barrel re-export chains. Type-only imports are always fine, because types are erased at compile time.
- **Server-only packages** — database drivers, mailers, crypto helpers, and similar packages are blocked from client modules, including through subpaths, aliases, and symlinks. Extend the list with `security.serverOnlyPackages` in `moons.config.ts`.

## Your responsibilities

The framework closes the accidental-leak door. What happens with your data is still up to you:

- **Never return secrets from a loader.** Loader data lands in the HTML payload.
- **Validate in the handler.** Schemas are public, so anything sensitive belongs in handler code, not in a schema literal.
- **Authentication is yours.** Moons has no built-in auth. Read a session cookie in `context(req)`, expose it as `ctx`, and guard loaders and `serverFn` handlers with it.

Ready to go deeper? [serverFn](/core-concepts/server-fn) covers the mechanics, and [Architecture](/architecture) explains how the three enforcement layers fit together.
