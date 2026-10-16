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
   `examples/m2-leak` fixture also sets `leakTest.canary` so the build itself
   fails if the canary appears (two failure paths, one truth).

Execution evidence: `scripts/m2/test-leak.sh`, `test-import-reject.sh`,
`test-error-format.sh` + transform unit tests (see `docs/decisions/0003-m2-zero-trust.md`).

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
- `plugins` are not executed yet; internal core integration is not a v1-supported
  path.
- Rendering `meta` (title/description) is not implemented in v1; use
  `index.html`.
- Client source maps are not enabled in the v1 build.
- The guarantee applies to the `moons()` plugin build pipeline; disabling the
  plugin or importing `.server.ts` through a non-Vite path is not a supported
  scenario.

## 8. Documentation language & register

Two registers are kept apart **on purpose**:

| Register | Language | Location | Reason |
| --- | --- | --- | --- |
| User documentation | Indonesian | `docs/site/**`, `docs/api/**`, `docs/migration/**`, `docs/manifest.md` | primary audience; API terms stay as-is (`serverFn`, `ctx`, `env()`) |
| Agent pack | English | `llms.txt`, `docs/ai/**` | agents read English technical terms; anti-drift via `scripts/ai/check-ai-links.ts` |

Label rules (sidebar & headings): descriptive sentences in Indonesian;
API identities and standard jargon (build, deploy, auth, CSRF, routing, loader,
`serverFn`, `ctx`, rate limit) are not translated.

**EN translation (2026-10-15, done)**: Starlight i18n is active —
`defaultLocale: "root"` (ID) + locale `en`, EN content in `docs/site-en/**`
(mapped by the generator to `src/content/docs/en/**`), per-locale sidebar labels
via `translations`. **All 20 site pages** have an EN counterpart
(`index`, `keamanan`, `mulai/*` 2, `dasar/*` 7, `panduan/*` 10); other ID pages
(`docs/api`, `docs/migration`, `docs/ai`) fall back to the root locale.
Conversely, `docs/ai/**` is deliberately EN with no ID counterpart (the agent
pack).

## 9. Documentation structure & guidelines

The site structure follows **Diátaxis** (tutorial → how-to → reference →
explanation) and the **Google developer documentation style guide** — the full
map + rationale in `docs/decisions/0025-docs-ia.md`. Practical rules:

- Internal history (decisions, milestone notes) is **not published**:
  `docs/decisions/**`, `docs/milestones/**` live in the repo only.
- New material goes in the right quadrant: "Start" (tutorial),
  "Guides" (how-to), "Reference", "Concepts"/"Architecture"
  (explanation); external examples under "Examples".
- Every site page has an EN counterpart (`docs/site-en/**`) with per-locale
  sidebar labels; non-site pages fall back to the root locale.

## 10. Closing

Other frameworks say: *"We make type safety end-to-end."*
Moons says: *"We make leaking server code to the client impossible.
If we fail, we do not deserve to exist."*

If you find a single path that can bypass this, it is not an ordinary bug —
it is a reason to stop this project until it is fixed.
