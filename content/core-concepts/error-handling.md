---
title: Error Handling
description: Custom 404 and error boundaries, redirect and notFound signals, and the [moons] error format with its machine-readable catalog.
---

Two files in your route tree define what users see when something fails: `_404.tsx` for missing pages and `_error.tsx` for thrown errors. Both render standalone, and Moons decides which one applies before your code runs.

## Boundary pages

- `src/routes/_404.tsx` — root only. It renders unmatched URLs and `notFound()` results with status 404.
- `_error.tsx` — allowed in any directory. When a page or loader throws, Moons walks up from the failing page and renders the nearest boundary; without a nested one, the root `_error.tsx` is used. Its response has status 500.

Boundaries nest: a `dashboard/_error.tsx` catches failures from `/dashboard/**` and anything below it, while the root file stays the fallback for the rest of the app.

Both files render standalone — no `_layout.tsx` wraps them — and both may export only `default`; any other export fails the build with `E_ROUTE_EXPORT_INVALID`. If `_404.tsx` is missing, a built-in plain 404 page is served; if `_error.tsx` is missing, a built-in 500 page is served.

```tsx
// src/routes/_error.tsx
import { useRouteError } from "@moonsjs/react";

export default function ErrorPage() {
  const error = useRouteError();
  return (
    <main>
      <h1>Something went wrong</h1>
      <p>Try again, or head back to the home page.</p>
      {error instanceof Error ? <pre>{error.message}</pre> : null}
    </main>
  );
}
```

## Reachable in development, hidden in production

During development, `useRouteError()` returns a revived `Error` carrying the thrown message and stack, so the boundary can show details without digging through server logs. In production, error details are never serialized into the response: `useRouteError()` returns `undefined`, and the page keeps whatever static fallback you wrote. The failure is still logged on the server. Design the boundary so it reads well with no error object at all.

As a rule of thumb, handle expected failures in the loader itself — return a result the page can render, such as `{ post: null }` — and reserve thrown errors for unexpected failures that should interrupt the render.

## notFound() and redirect()

Both signals are imported from `@moonsjs/react` and thrown from a loader (or a `meta` function); execution after them stops.

```tsx
// src/routes/blog/[slug].tsx
import { notFound, redirect, type LoaderArgs } from "@moonsjs/react";

export const loader = async ({ params }: LoaderArgs<"/blog/[slug]">) => {
  const post = await findPost(params.slug);
  if (post === null) notFound();
  if (post.movedTo !== undefined) redirect(post.movedTo, 301);
  return { post };
};
```

- `notFound()` renders the `_404` page with status 404.
- `redirect(to, status?)` returns an HTTP redirect. Supported statuses are 301, 302, 303, 307, and 308; the default is 302. Relative destinations resolve against the request URL, so `redirect("/login")` keeps the current host.

During a client-side navigation, redirects are followed by the document fetch and the history entry is committed with the final URL. A destination that answers 404 or 500 falls back to a full document load, so the boundary page renders exactly as it would on a fresh visit (see [Navigation & Search Params](/core-concepts/navigation)).

## Transport errors

Some failures are answered by the HTTP transport before or around your code, with the same `[moons]` format:

- `E_REQUEST_TIMEOUT` — a handler did not respond within `requestTimeoutMs` (default 30 seconds); the transport answers `504`. The handler keeps running until it settles.
- `E_RPC_BODY_TOO_LARGE` — an RPC body exceeded `security.bodyLimitBytes`; the transport answers `413` without buffering the whole body.

Transport responses still carry your `headers` config and the default security headers.

## The [moons] error format

Errors raised by the framework — at build time and at runtime — share one format: a header with the code, a location, a one-line description, an explanation, and actionable suggestions.

A server function that receives input its schema rejects:

```bash
[moons] E_RPC_INVALID_INPUT

POST /_moons/fn/8f3a91c2d4e5f607
  input does not match the schema: title: <issue message from the schema library>

Server function input must pass `input` schema validation.

Suggestion:
  1. Check the argument types at the call site, or
  2. Update the `input` schema
```

And a client module importing a non-`serverFn` value from a server file:

```bash
[moons] E_SERVER_IMPORT_IN_CLIENT

src/routes/invoices.tsx:2
  importing `db` from src/server/db.server.ts

Server code must not appear in the client.
Only `serverFn` may cross.

Suggestion:
  1. Create a server function that returns the data you need, or
  2. If the value is genuinely public, redefine the constant in a client-safe module (never move secret values)
```

Build-time errors stop the build before anything runs; runtime errors surface as boundary pages for pages, as error responses for RPC and API calls, and in the server log.

## The error catalog

`moons errors` prints every code with a short trigger, and `moons errors --json` emits the same content as JSON:

```bash
moons errors          # every code with a short trigger
moons errors --json   # { moonsVersion, count, errors: [...] }
```

Each entry carries `code`, `trigger`, `details`, and `suggestions`. The same data is exported from `@moonsjs/core` as `MoonsError`, `ERROR_CATALOG`, and `findErrorEntry` (see [@moonsjs/core](/api/core)), so tools and tests can branch on codes instead of parsing messages.
