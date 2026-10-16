---
description: "serverFn: one schema on two sides, stable hashes, x-moons RPC, and the *.server.ts rule for secrets."
---

# serverFn

```ts
// src/server/users.server.ts — the only place for secrets
import { serverFn } from "@moonsjs/server";
import { z } from "zod";

export const renameUser = serverFn({
  input: z.object({ id: z.string(), name: z.string().min(1) }),
  output: z.object({ ok: z.boolean() }),
  handler: async ({ input, ctx }) => {
    await db.users.update(input.id, input.name);
    return { ok: true };
  },
});
```

Call it from the client (`await renameUser({ input: { id, name } })`) — the
import in a route file becomes an RPC stub.

- **Two-sided validation**: the schema is checked on the client (before fetch)
  and re-checked on the server.
- Schemas must be **inline expressions or imports**; a schema referencing a
  local top-level declaration is rejected at build time with
  `E_SCHEMA_LOCAL_REF` (the error shows a before/after diff).
- Client may import **named serverFn exports only**; `default` and `import * as`
  are rejected (`E_SERVER_IMPORT_IN_CLIENT`).
- Hash = first 16 hex chars of `sha256("<rel-path>#<export>")`; identical in
  dev/build/SSR — `moons fns --json` prints the registry.
- Wire format: `POST /_moons/fn/<hash>`, headers `x-moons: 1` +
  `content-type: application/x-moons`, devalue body/response.
- Guard data with `ctx` inside the handler (auth pattern in
  [Auth & CSRF](/guides/auth-csrf/)).
