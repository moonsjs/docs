---
description: "In-process testing with createTestServer: dispatch Requests without a port — the template bun test pattern."
---

# Testing

```ts
// test/example.test.ts
import { expect, test } from "bun:test";
import { scanRoutes, type MoonsConfig, type RouteModule } from "@moonsjs/core";
import { createTestServer } from "@moonsjs/vite/server";
import { join } from "node:path";

const routesDir = join(import.meta.dir, "..", "src", "routes");
const config: MoonsConfig = { routesDir: "src/routes", context: async () => ({}) };

const server = createTestServer({
  routes: scanRoutes(routesDir),
  config,
  routesDir,
  loadRoute: {
    _layout: async () => (await import("../src/routes/_layout")) as unknown as RouteModule,
    index: async () => (await import("../src/routes/index")) as unknown as RouteModule,
  },
});

test("/ renders SSR with loader data", async () => {
  const response = await server.fetch("/");
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("Halo dari SSR");
});
```

- No port, no browser: dispatch `Request` objects directly.
- Include every route/module that the page uses (layouts included).
- Assert SSR markup, payload content, status codes, and response headers
  (`set-cookie`, etc.).
- Run with `bun test`.
