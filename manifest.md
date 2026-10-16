# Manifest — Why the Server/Client Boundary Is Dangerous

> This document lays out Moons' position on how other frameworks guard the
> server→client boundary. The tone is firm; the claims made are only ones you
> can verify from this repo (the build-time transform rejection, the leak test)
> or public mechanisms you can inspect in the relevant framework's docs.

## 1. The claim

> **Moons: the full-stack TypeScript framework that makes leaking server code
> to the client impossible.**

Leaking server code into the client bundle is not a "managed risk" — it is a
category failure. Once a handler, a secret, or an `env()` value ships to the
browser, no mitigation pulls it back: the bundle is already in the user's hands.
That is why Moons treats a leak as a **project-stopping condition**: if the
transform can be bypassed, this framework is a lie.

## 2. The definition of "impossible"

`dist/client/**` MUST NOT contain:

1. The contents of `serverFn` handlers (any line).
2. Real `*.server.ts` imports other than the RPC stub.
3. `node:*`, `bun:*`, or server-only module imports.
4. `env()` values.
5. Server constants/strings/comments.
6. The contents of real `*.server.ts` files (stubs only).

Enforced in three layers: the **build-time transform**, the **build-time
rejection**, and the **CI leak test** (a canary is injected, `dist/client` is
scanned, and the build fails if it is found).

## 3. How leaks actually happen

Six paths that recur in practice:

| # | Path | Example |
|---|---|---|
| 1 | Direct import | a route imports a helper/constant from a server module |
| 2 | Indirect import | an `export *` barrel / intermediary file pulls in a server module |
| 3 | Dynamic import | `await import("./debug.server")` on a client path |
| 4 | Env values | private variables inlined into client code |
| 5 | Handler bodies | closures/handlers get bundled anyway because the module is imported whole |
| 6 | Leftover artifacts | comments, constants, source maps, stubs that return a server `Response` |

All six slip past review easily: all that shows up in the diff is a single
import line.

## 4. How the common approaches work

Established frameworks each have their own answer — and that answer is generally
**based on convention + discipline**:

- **Public prefixes for env** (e.g. `NEXT_PUBLIC_`, `PUBLIC_*`): variables without
  the prefix stay out of the client — as long as the naming is right.
- **Server-only packages/markers** (e.g. `server-only`, the `'use server'`
  directive, the `$lib/server` folder, `server/`): a wrong import is rejected by
  the compiler *if* the marker is in place.
- **File naming conventions** (e.g. `*.server.ts`): server modules are kept
  apart from the client — relying on consistent naming.
- **Tree-shaking/edge bundling**: hoping unused code is dropped — the failure
  is silent (no error, just bytes shipped).

These patterns work well enough for disciplined teams. The problem: the
guarantee is a *"must not"* enforced through human review — not a *"cannot"*
enforced by a build that fails.

## 5. The three enforcement layers in Moons

1. **Transform** — every `*.server.ts` that enters the client graph is replaced
 by a stub: only the `input`/`output` schemas + the stable hash remain; the
 handler body, non-`serverFn` exports, and `node:*`/`bun:*` imports are **discarded**.
   Illegal imports (non-`serverFn`, default, namespace, dynamic import without a
   `DEV` guard), `env()` calls, and `node:*` imports **fail the build** with the
 full `file:line` error + `Saran`.
2. **Build rejection** — the same rules are evaluated in dev and build,
   including re-exports and conditional imports.
3. **CI leak test — sacred**: the canary is planted in a fixture handler; after
   the build, `dist/client` is scanned; if found → **merge is forbidden**. The
   framework's leak fixture also sets `leakTest.canary` so the build itself
   fails if the canary appears (two failure paths, one truth).

Enforced in the framework CI: leak tests, import-rejection tests, error-format
tests, and transform unit tests.

## 6. Mechanism comparison

| Question | Common convention | Moons |
|---|---|---|
| Server/client module boundary | File names / marker packages / directives | `*.server.ts` + stub transform (the real code never enters the client graph) |
| Illegal imports | Review + compiler when marked | Build fails (`E_SERVER_IMPORT_IN_CLIENT`) with `file:line` + suggestions |
| Handler bodies on the client | Depends on tree-shaking | Handlers are structurally replaced by stubs; there is no "whole handler" path |
| Dynamic imports | Usually not enforced | Rejected (`E_SERVER_IMPORT_IN_CLIENT`) unless the branch is `DEV`-dead at build time |
| Private env | A naming-discipline test | `env()` is server-only; called in the client → `E_ENV_IN_CLIENT` (build + runtime) |
| Boundary validation | Optional per project | Required `input`/`output` schemas on both sides |
| Leak evidence | The team's own tests | The framework-level leak test must be green; red = merge forbidden |

## 7. Honest limits

- Code written in client modules **is client code by definition** — Moons does
  not hide what you put there.
- Plugins run inside the Vite pipeline (routes, middleware, context); they are
  not a sandbox against code you deliberately place in client modules.
- `meta` renders title, description and Open Graph tags on the server and keeps
  them in sync on client-side navigation.
- Client source maps are not emitted by default.
- The guarantee applies to the `moons()` plugin build pipeline; disabling the
  plugin or importing `.server.ts` through a non-Vite path is not a supported
  scenario.

## 8. Closing

Other frameworks say: *"We make type safety end-to-end."*
Moons says: *"We make leaking server code to the client impossible.
If we fail, we do not deserve to exist."*

If you find a single path that can bypass this, it is not an ordinary bug —
it is a reason to stop this project until it is fixed.
