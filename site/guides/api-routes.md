---
description: "Raw HTTP endpoints in src/api/*.ts: method handlers, ctx, HEAD/OPTIONS automation, and the explicit security model (no automatic RPC CSRF)."
---

# Raw HTTP endpoints — `src/api/*.ts`

```ts
// src/api/webhooks/[provider].ts — server-only
import type { ApiHandlerArgs } from "@moonsjs/server";

export const POST = async ({ req, params, ctx }: ApiHandlerArgs): Promise<Response> => {
  const signature = req.headers.get("x-signature") ?? "";
  const raw = await req.text();
  if (!verifySignature(raw, signature, env("WEBHOOK_SECRET"))) {
    return new Response("invalid signature", { status: 401 });
  }
  return new Response(null, { status: 204 });
};
```

- URL = `/<apiDir basename>/<path>` → `src/api/hello.ts` = `/api/hello`;
  `[param]`, `[...rest]`, `(group)` work like pages; `apiDir` defaults to
  `"src/api"`.
- Only method handlers are legal: `GET`, `HEAD`, `POST`, `PUT`, `PATCH`,
  `DELETE`, `OPTIONS`. Anything else (including `default`) fails the build with
  `E_API_HANDLER_INVALID`.
- Handlers receive `{ req, params, ctx }`; global middleware applies, plus
  `_middleware` in the api tree (D.3).
- `HEAD` is auto-derived from `GET` (empty body); `OPTIONS` → `204` + `Allow`;
  method without handler → `405` + `Allow`.
- `moons routes --json` lists entries with `kind: "api"` + `methods`.

## Example: sitemap

```ts
// src/api/sitemap.ts
export const GET = (): Response =>
  new Response(`<?xml version="1.0"?><urlset><url><loc>/</loc></url></urlset>`, {
    headers: { "content-type": "application/xml" },
  });
```

## Security model

- `src/api/**` files are **server-only**: importing them from client modules
  **fails the build** (`E_FORBIDDEN_SERVER_IMPORT`, "API module" source).
- **The RPC CSRF/origin checks do not apply here.** Raw endpoints are public by
  default — verify signatures/tokens yourself, or add protection in global
  middleware.
- `security.bodyLimitBytes` does **not** apply to API routes; enforce your own
  limits (see [File uploads](/guides/uploads/)).
