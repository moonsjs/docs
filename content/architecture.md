---
title: Architecture
description: Why the server/client boundary is dangerous, the three layers that enforce it, and the limits you still own.
---

Most server/client leaks are not dramatic. Someone imports a database helper "just for the type", a shared component reaches for `process.env`, a loader returns a whole config object — and credentials end up in a JavaScript file that any visitor can download. Nothing crashes, nothing logs, and the mistake is invisible unless you read every byte of the output.

Moons makes that class of mistake structural instead of accidental. Three layers cooperate, and each one can stop the build on its own.

## Layer 1: the build transform

Files named `*.server.ts` or `*.server.tsx` are server-only by contract. During the client build, the transform replaces each one with an RPC stub. A stub keeps:

- the exported name and function signature,
- the `input` and `output` schemas (so the client can validate), and
- a stable hash that identifies the handler on the server.

The handler body, the imports it uses, and every value it closes over are left out of the client graph entirely. Calling the function in the browser posts the input to the matching RPC endpoint; calling it during server rendering runs in-process instead. Either way, there is no code path where the handler body can be imported and shipped — it was never bundled.

## Layer 2: compile-time rejection

The transform also inspects every import that enters a client module. If the import resolves to server-only code, the build stops with a `[moons]` error that names the file and line:

- `E_SERVER_IMPORT_IN_CLIENT` — a value that is not a `serverFn` is being imported from a `*.server.ts` file, or through a re-export chain.
- `E_FORBIDDEN_SERVER_IMPORT` — the import targets `node:*`/`bun:*`, a server-only package, `src/server/**`, `src/api/**`, or `moons.config.ts`.
- `E_ENV_IN_CLIENT` — `env()` is called in a module that ends up in the client bundle.

The checks run on what an import actually resolves to, not just the literal path. Aliases, symlinks, subpath imports, and barrel files all resolve to the same answer. There is no supported way to opt out; the rejection is the feature.

## Layer 3: the leak canary

Transforms can have bugs, so the build does not trust them blindly. The scaffold sets a canary in `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import moons from "@moonsjs/vite";

export default defineConfig({
  plugins: [moons({ leakTest: { canary: "MOONS_APP_CANARY_4f1c" } })],
});
```

Put the same string somewhere that belongs only on the server — a constant in a `*.server.ts` module is the usual spot. After the client bundle is produced, the build searches every output file for the canary. If the string appears anywhere in `dist/client`, the build stops: server code reached the browser, and a silent leak would have shipped.

The canary turns "the transform looked correct" into an observable fact about the final artifact.

## How moons check ties it together

`moons check` runs the whole pipeline as one command, in dependency order:

1. **typegen** — regenerate typed routes and `ctx`.
2. **TypeScript checking** — `tsc --noEmit` across the project.
3. **client build** — the transform, the import rejections, and the canary check.
4. **server build** — the SSR and server bundle.
5. **prerender** — static routes, guarded against leaks in their output.

Each step either passes or stops the chain with a non-zero exit code. One command answers whether the boundary still holds, the types still line up, and both bundles still build.

## Honest limits

The guarantee is about server code not shipping to the client. It is not a full application security program. Know the edges:

- **Loader data is embedded in the HTML.** It travels to the browser by design. Never return secrets from a loader.
- **Schemas are public.** Input and output schemas are part of the client bundle so the browser can validate. Sensitive checks belong in the handler.
- **The `.server.ts` suffix is the contract.** `src/server/**` and `moons.config.ts` get extra protection, but a server-only helper named `db.ts` outside those locations is not recognized as server-only. Name files according to the contract.
- **Code in client modules is client code.** If a module is imported from a route or component, assume it ships. Shared modules should be safe to read.
- **Raw `src/api` routes have their own rules.** They are server-only files, but requests to them do not get the RPC origin checks, so verify tokens and signatures yourself.
- **Authentication is your responsibility.** Moons provides the boundary, not a session system. Guard loaders and `serverFn` handlers with your own checks.

For the day-to-day version of all this, see [Zero-Trust Model](/core-concepts/zero-trust).
