---
title: Testing
description: Test routes, schemas, and API handlers with bun test, then smoke-test the production build.
---

Testing has two layers: in-process tests with `bun test`, and a smoke run against the production build. The first catches component and loader mistakes; the second proves the build, server bundle, and RPC path still work together.

## The starter test

The scaffold includes `test/example.test.ts`. It scans the route directory, points `createTestServer` at the route modules, and dispatches requests without a port:

```ts
import { expect, test } from "bun:test";
import { scanRoutes, type MoonsConfig, type RouteModule } from "@moonsjs/core";
import { createTestServer } from "@moonsjs/vite/server";
import { join } from "node:path";

const routesDir = join(import.meta.dir, "..", "src", "routes");
const config: MoonsConfig = {
  routesDir: "src/routes",
  context: async () => ({ requestId: "test", url: "" }),
};

const server = createTestServer({
  routes: scanRoutes(routesDir),
  config,
  routesDir,
  loadRoute: {
    _layout: async () => (await import("../src/routes/_layout")) as unknown as RouteModule,
    index: async () => (await import("../src/routes/index")) as unknown as RouteModule,
  },
});

test("/ renders loader data", async () => {
  const response = await server.fetch("/");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");
  const html = await response.text();
  expect(html).toContain("Hello from SSR");
});

test("unknown paths return 404", async () => {
  expect((await server.fetch("/missing")).status).toBe(404);
});
```

Run the file with `bun test`. `createTestServer` is exported from `@moonsjs/vite/server` and returns `{ handler, fetch }`. `fetch` accepts a path plus optional `RequestInit` and resolves it against `http://localhost`; it uses an in-memory shell unless you pass one. It handles layouts, loaders, meta, the custom `_404`, and `/_moons/health`.

Two limits matter. The test server has no API route map, so call `src/api` handlers directly (below). And route modules are imported with Bun, not compiled by Vite: a route that imports a `serverFn` loads the server file without the compile step that gives the function its hash, and fails at import. Use this server for plain loaders; test server-function pages against the built app.

## Schema tests

A server function's input rule is its schema. The browser stub and the server both run that schema before the handler, so a schema test covers both sides without a request context.

```ts
// test/schemas.test.ts
import { expect, test } from "bun:test";
import { addNoteInput } from "../src/shared/schemas";

test("note titles are validated for the client and the server", () => {
  expect(addNoteInput.safeParse({ title: "Ship it" }).success).toBe(true);
  expect(addNoteInput.safeParse({ title: "   " }).success).toBe(false);
  expect(addNoteInput.safeParse({ title: "x".repeat(81) }).success).toBe(false);
});
```

The server repeats the check even when a client skips it, so this test covers what the handler accepts; there is no server-only copy to sync.

## API handlers

`ApiHandlerArgs` is `{ req, params, ctx }`. Call the exported method with a `Request` and a minimal context; it returns a normal `Response`.

```ts
// src/api/echo.ts
import type { ApiHandlerArgs } from "@moonsjs/server";

export async function POST({ req }: ApiHandlerArgs): Promise<Response> {
  const body = (await req.json()) as { message?: unknown };
  if (typeof body.message !== "string" || body.message.length === 0) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }
  return Response.json({ message: body.message });
}
```

```ts
// test/echo.test.ts
import { expect, test } from "bun:test";
import type { ApiHandlerArgs } from "@moonsjs/server";
import { POST } from "../src/api/echo";

const ctx = { requestId: "test" } as ApiHandlerArgs["ctx"];

function call(body: unknown): Promise<Response> {
  return POST({
    req: new Request("http://localhost/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    params: {},
    ctx,
  });
}

test("echo validates its body", async () => {
  const ok = await call({ message: "hello" });
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual({ message: "hello" });
  expect((await call({})).status).toBe(400);
});
```

An API module that imports a `serverFn` hits the same limit; exercise that through the built app. This tests the handler contract, not the URL mapping; the build checks the exports.

## Smoke-test the build

`bun test` never runs the Vite transform. The production build does, so finish with one request-level check against the built server. Put this in `scripts/smoke.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

bun run check
bun run build
PORT=3100 bun run start &
server=$!
trap 'kill "$server"' EXIT

for _ in $(seq 1 50); do
  if curl -fsS http://localhost:3100/_moons/health > /dev/null 2>&1; then break; fi
  sleep 0.2
done

body="$(curl -fsS http://localhost:3100/)"
grep -q "Hello from SSR" <<<"$body"
echo "smoke passed"
```

`bun run check` runs typegen, typechecking, both builds, and prerender; `bun run build` produces the deployable output. `PORT` moves the server off 3000, and `/_moons/health` answers `{ "ok": true }` before pages are served. The final request checks the template home page; swap in a route you seed deterministically.

A loader is not called on its own here: the router supplies `{ params, ctx, req }` from the request, so keep the request realistic. See [Loaders](/core-concepts/loaders) for that contract.

## Continuous integration

```yaml
name: test
on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun test
      - run: bash scripts/smoke.sh
```

The smoke script runs the typecheck, both builds, and the HTTP request, so continuous integration fails on a broken transform or server bundle, not only on a failed unit test. Keep it in the repository so local and remote runs match.
