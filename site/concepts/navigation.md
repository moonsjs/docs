---
description: "Link + refresh(): client navigation without reloads, scroll restoration, URL params via useSearchParams, pending UI and prefetch."
---

# Navigation, Link & search params

```tsx
import { Link, refresh, useSearchParams } from "@moonsjs/react";

<Link to="/users/[id]" params={{ id: "u1" }} search={{ tab: "profile" }}>Profile</Link>
```

- Left-click without modifiers = client-side navigation (fetch + swap +
  hydrate); no full reload.
- Loader data is re-fetched from the server on every navigation.
- **Local `useState` is re-created** on re-render — treat the server payload as
  the source of truth.
- **Pending UI **: `const { pending, url } = useNavigation` is
  `true` from click/popstate until swap+hydrate finishes (SSR snapshot is always
  `pending: false`).
- **Prefetch (D.4)**: `<Link>` prefetches its target on hover/focus by default
  (in-memory TTL ~10s, consumed once). Opt out with `prefetch={false}`. Prefetch
  never touches serverFn/RPC.

## Query params

```tsx
export default function Search() {
  const { q } = useSearchParams();
  return <p>query: {q ?? "-"}</p>;
}
```

The same values are available in loaders via `new URL(req.url).searchParams`.

## Refresh after mutations

```tsx
await addNote({ input: { title } });
refresh(); // re-runs the current URL through the document-fetch pipeline
```
