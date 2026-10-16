---
description: "Server-side loaders: params, ctx, devalue serialization, and the no-secrets rule (payload lands in the HTML)."
---

# Loaders

```tsx
import { useLoaderData, type LoaderArgs } from "@moonsjs/react";

export const loader = async ({ params, ctx, req }: LoaderArgs<"/users/[id]">) => ({
  user: await getUser({ input: { id: params.id } }),
  requestId: ctx.requestId,
});

export default function Page() {
  const data = useLoaderData<typeof loader>();
  return <h1>{data.user.name}</h1>;
}
```

- Loader args: `{ params, ctx, req }`. Returning a `Response` is an error —
  use middleware for status/headers.
- Loaders run on the server for SSR **and** client-side navigation (the client
  fetches the document).
- Loader data is serialized with **devalue**: `Date`, `Map`, `Set`, `BigInt`,
  `undefined`, `NaN` survive server→client.
- **Never return secrets**: loader data is embedded into the HTML payload. For
  credential work use a `serverFn` in `*.server.ts`.
- Dedupe per request with `cache()` from `@moonsjs/server` when layout and page
  loaders need the same data.
- `meta` (page only) runs server-side after the loader; routing signals
  `redirect()`/`notFound()` are thrown from loaders/meta.
