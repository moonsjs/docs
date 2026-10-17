---
title: API Routes
description: Raw HTTP endpoints under src/api, from file mapping and method handlers to an explicit security model.
---

Not every endpoint is a server function. `src/api` holds raw HTTP handlers for webhooks, uploads, file downloads, and machine-readable responses, where you control the request and response directly.

## File mapping

A file in `src/api` becomes a URL under `/api`. Only `.ts` files are scanned; `.d.ts` files and names starting with `_` are skipped.

| File | URL |
| --- | --- |
| `src/api/index.ts` | `/api` |
| `src/api/hello.ts` | `/api/hello` |
| `src/api/users/[id].ts` | `/api/users/:id` |
| `src/api/files/[...rest].ts` | `/api/files/*` |
| `src/api/(internal)/metrics.ts` | `/api/metrics` |

`index.ts` maps to its directory. `[param]` is a dynamic segment, and `(group)` folders never appear in the URL. `[...rest]` is a catch-all: it captures the rest of the path, so keep it last. Its remainder arrives under the `"*"` key in `params`; dynamic segments use their own names. Two files that resolve to the same URL pattern — including `[id].ts` and `[uid].ts` in one directory — fail the build with `E_API_ROUTE_CONFLICT`. Static segments win over dynamic ones, and dynamic over a catch-all.

## Handler contract

API modules export one function per HTTP method: `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS`. Any other named export, a default export, or a module with no handler fails the build with `E_API_HANDLER_INVALID`; move helpers to another module.

A handler receives `{ req, params, ctx }` as `ApiHandlerArgs` and returns a standard `Response`. `ctx` is the same per-request context your loaders and server functions see. `HEAD` is derived from `GET` with an empty body, `OPTIONS` answers `204` with an `Allow` header, and a method without a handler returns `405` with `Allow`.

```ts
// src/api/tasks/[id].ts
import { setHeader, type ApiHandlerArgs } from "@moonsjs/server";

type Task = { id: string; title: string; done: boolean };

const tasks = new Map<string, Task>([
  ["1", { id: "1", title: "Write docs", done: false }],
]);

export async function GET({ params }: ApiHandlerArgs): Promise<Response> {
  const task = tasks.get(params.id);
  if (task === undefined) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  setHeader("cache-control", "no-store");
  return Response.json(task);
}

export async function PATCH({ req, params }: ApiHandlerArgs): Promise<Response> {
  const task = tasks.get(params.id);
  if (task === undefined) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json()) as { done?: unknown };
  if (typeof body.done !== "boolean") {
    return Response.json({ error: "`done` must be a boolean" }, { status: 400 });
  }
  const updated = { ...task, done: body.done };
  tasks.set(updated.id, updated);
  return Response.json(updated);
}
```

`setHeader`, `appendHeader`, `setCookie`, and `deleteCookie` work inside API handlers; changes apply to the final response.

## Bodies, uploads, and streams

Read bodies with `req.text()`, `req.json()`, `req.formData()`, `req.arrayBuffer()`, or the raw `req.body` stream. Multipart uploads use `formData()`; check `content-length` before reading and each file's `size` after parsing. `security.bodyLimitBytes` applies to RPC calls only, so raw endpoints need their own limit; the transport's 32 MB cap and `413` are a safety net, not a policy.

A response body can be a `ReadableStream`; the server pipes it to the socket instead of buffering it:

```ts
// src/api/events.ts
export function GET(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("ready\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
```

## The security model is explicit

`serverFn` calls go through `POST /_moons/fn/<hash>`, require the `x-moons: 1` header, check the request `Origin` against the host or `security.originWhitelist`, and enforce `security.bodyLimitBytes`. Raw endpoints get none of that: no origin check, no `x-moons` header, no `security.bodyLimitBytes`. They are public by default; protect them with global middleware, API-tree `_middleware.ts` files, or checks in the handler.

For third-party callers, verify their proof yourself; a webhook can check an HMAC signature before parsing the payload:

```ts
// src/api/webhooks/[provider].ts
import { env, type ApiHandlerArgs } from "@moonsjs/server";

const encoder = new TextEncoder();

async function hmac(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function equal(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export async function POST({ req, params }: ApiHandlerArgs): Promise<Response> {
  const body = await req.text();
  const received = req.headers.get("x-signature") ?? "";
  const expected = await hmac(body, env<string>("WEBHOOK_SECRET"));
  if (!equal(received, expected)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }
  return Response.json({ provider: params.provider, bytes: body.length });
}
```

## When to prefer serverFn

Use a server function when your own app calls your own server: input and output are validated on both sides, the origin check applies, and the client never sees the URL. Use `src/api` when a third party owns the protocol, when you need full control of status and headers (XML, files, redirects), or when you accept bodies that the RPC layer is not meant to carry, such as large multipart uploads.

API modules are server-only. Importing one from a route or component fails the build with `E_FORBIDDEN_SERVER_IMPORT`. For cross-cutting checks, see [Middleware](/guides/middleware); for session checks in raw endpoints, see [Authentication](/guides/authentication).
