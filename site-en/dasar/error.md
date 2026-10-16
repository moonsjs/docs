---
description: "Error format [moons] CODE + Suggestion, _404/_error pages, redirect()/notFound(), and what production reveals."
---

# Errors, redirect & 404

## Runtime error format

Every framework error follows:

```txt
[moons] E_SERVER_IMPORT_IN_CLIENT — src/routes/x.tsx:3
importing `readFileSync` from `node:fs` in a client module
Details: modules that are server-only may only be imported from *.server.ts.
Suggestions:
  1. Move the operation into a serverFn
  2. Remove the import
```

The catalog is machine-readable: `moons errors --json` (or MCP `explain_error`).

## Custom pages

- `_404.tsx` (root only) renders unmatched URLs with status 404.
- `_error.tsx` may live in **any directory**: the nearest
  boundary from the failing page is used.
- **Production never serializes error details** into markup or payload
; dev shows them.

## Routing signals

```tsx
export const loader = async ({ params }: LoaderArgs<"/users/[id]">) => {
  const user = await getUser({ input: { id: params.id } });
  if (user === null) notFound();            // → _404 with status 404
  if (!user.active) redirect("/login", 303); // → HTTP redirect (default 302)
  return { user };
};
```

- `redirect(to, status?)` — relative `to` resolves against the request URL;
  supported statuses: 301/302/303/307/308.
- Client navigation follows redirects via `fetch`; the history entry uses the
  **final URL**.
- Documents ending in 404/500 fall back to a full page load (not SPA swap).
