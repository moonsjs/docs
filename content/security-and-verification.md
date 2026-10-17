---
title: Security and Verification
description: The three zero-trust guarantees, their honest current status, and the adversarial corpus you can run yourself.
---

Moons makes one promise central: server code that would reach the client bundle fails the build instead of shipping. This page is the honest accounting of that promise — the three guarantees behind it, which ones you can rely on today, which ones cannot be claimed yet, and the executable tests behind the difference.

## The three guarantees

"Zero-trust" in Moons means three boundaries. Each one has a different maturity level, and this table is deliberately conservative.

| ID | Guarantee | What it means | Status |
| --- | --- | --- | --- |
| G1 | Code boundary | Server-only code — `*.server.ts(x)` modules, `src/server/**`, `src/api/**`, `moons.config.ts`, and the built-in server-only packages — that reaches the client bundle fails the build. | **Mostly in place.** Every build enforces the transform and the import rejections. The canary is the weak spot: the check only runs when `leakTest.canary` is configured, and a configured canary that never appears in server code verifies nothing. Per-module markers with an automatic positive control are planned for 0.9.0. |
| G2 | Request boundary | No `serverFn` or `src/api` endpoint can be called without an explicit access declaration. | **Not yet.** A `serverFn` is callable by anyone who can reach the app, and a `src/api` endpoint is public unless you write your own checks. Access declarations with default-deny are planned for 0.9.0 as a breaking change with a migration guide. Until then, guard every handler yourself ([Authentication](/guides/authentication)). |
| G3 | Data boundary | Secret values do not reach the browser through the HTML payload, loaders, or the bundle. | **Partial.** Prerendered output is scanned at build time and a hit fails the build. `moons audit` scans `dist/client` for the canary and for secret-looking environment values, and the dev server warns when the SSR payload contains one. Scanning `env()` values in the payload by default in dev and test is planned for 0.9.0, with production opt-in. |

If your threat model needs all three guarantees verified today, only G1 is usable — and with the canary caveat above. Until G2 and G3 ship, the request and data boundaries are your responsibility, not the framework's; [Zero-Trust Model](/core-concepts/zero-trust) lists what crosses the boundary by design.

## Built-in server-only packages

Client modules cannot import the packages below. The rejection runs on what an import actually resolves to, so subpaths, aliases, symlinks, and re-export chains hit the same gate, and the build fails with `E_FORBIDDEN_SERVER_IMPORT`. The list is a built-in minimum that an app cannot remove; extend it with `security.serverOnlyPackages` in `moons.config.ts`, and any package can opt in with `"moons": { "serverOnly": true }` in its `package.json`.

<!-- generated:server-only-packages -->
- `pg`
- `postgres`
- `mysql`
- `mysql2`
- `sqlite3`
- `better-sqlite3`
- `drizzle-orm`
- `@prisma/client`
- `prisma`
- `mongodb`
- `mongoose`
- `redis`
- `ioredis`
- `bcrypt`
- `bcryptjs`
- `argon2`
- `jsonwebtoken`
- `nodemailer`
- `sharp`
- `execa`
- `cross-spawn`
- `dotenv`
- `knex`
- `typeorm`
- `sequelize`
- `@libsql/client`
<!-- /generated:server-only-packages -->

## The adversarial corpus

Every claim about the boundary is backed by a test in the repository. The corpus covers the import shapes, package rules, and output scans a real codebase can produce.

| Test | What it checks | Expected |
| --- | --- | --- |
| [adversarial.sh](https://github.com/moonsjs/Moons/blob/main/quality/e2e/zero-trust/adversarial.sh) | Exotic import shapes: `?raw` and `?url` queries, `import.meta.glob`, dynamic template imports, aliases, tsconfig paths, symlinks, non-contract extensions (`.server.js`), and case variants (`.SERVER.TS`). | build fails |
| [import-reject.sh](https://github.com/moonsjs/Moons/blob/main/quality/e2e/zero-trust/import-reject.sh) | A route importing a value that is not a `serverFn` from a `*.server.ts` file, with the full error shape. | build fails |
| [server-only-import.sh](https://github.com/moonsjs/Moons/blob/main/quality/e2e/zero-trust/server-only-import.sh) | Server-only packages through direct and dynamic imports, `export *` and renamed re-exports, subpaths, aliases, tsconfig paths, symlinks, and configured lists — plus two positive controls. | build fails (positive controls pass) |
| [leak.sh](https://github.com/moonsjs/Moons/blob/main/quality/e2e/zero-trust/leak.sh) | The final client bundle, byte by byte: canary string, secret literal, and an internal identifier. | blocked |
| [leak-matrix.sh](https://github.com/moonsjs/Moons/blob/main/quality/e2e/zero-trust/leak-matrix.sh) | 26 scenarios from an adversarial review, kept as permanent regressions: barrel re-exports, schema references, `process.env` versus `import.meta.env`, default and namespace imports, and type-only imports. | build fails or controlled public leak |

Most scenarios in the matrix must fail the build with a Moons error code; the rest must pass with no marker in `dist/client`. A few rows assert a *controlled public leak* — schemas and `VITE_*` values that are public by contract — so those values cannot quietly stop being public either. Failures are fail-closed: a build that fails never leaves a marker in a partial `dist/client`.

## Running the corpus yourself

```bash
# from a checkout of the Moons repository
bun install
bun run build
bun run e2e zero-trust
```

The filter runs the five files above through the canonical test runner. Each scenario prints `OK` or `FAIL`, and the command exits non-zero on the first failure. The full suite — this area included — runs in CI on every change.

## Reporting a vulnerability

If you find a way to move server-only code, secrets, or `env()` values into `dist/client`, or to bypass an import rule, report it privately — do not open a public issue. Each package has its own policy and advisory link:

- [@moonsjs/core](https://github.com/moonsjs/core/blob/main/SECURITY.md)
- [@moonsjs/server](https://github.com/moonsjs/server/blob/main/SECURITY.md)
- [@moonsjs/react](https://github.com/moonsjs/react/blob/main/SECURITY.md)
- [@moonsjs/vite](https://github.com/moonsjs/vite/blob/main/SECURITY.md)
- [@moonsjs/cli](https://github.com/moonsjs/cli/blob/main/SECURITY.md)
- [@moonsjs/mcp](https://github.com/moonsjs/mcp/blob/main/SECURITY.md)

Confirmed reports are fixed before disclosure and become regression scenarios in the corpus. Loader data, public schemas, and the other values documented as public are out of scope by design.

## Related

- [Zero-Trust Model](/core-concepts/zero-trust) — the day-to-day rules of the boundary and what stays your responsibility.
- [Architecture](/architecture) — the three enforcement layers and their limits.
