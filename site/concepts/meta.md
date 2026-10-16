---
description: "meta({ data }) runs server-side → title/description/Open Graph on SSR and after client-side navigation."
---

# Meta (title & SEO)

```tsx
import { useLoaderData, type RouteMetaFn } from "@moonsjs/react";

export const loader = async () => ({ nama: "Alice" });

export const meta: RouteMetaFn<typeof loader> = ({ data }) => ({
  title: `Profile ${data.nama} — App`,
  description: "User profile page.",
});
```

- `meta` is page-only (not on `_layout`/`_error`/`_404`); other shapes →
  `E_ROUTE_EXPORT_INVALID`.
- `data` is the page's own loader result.
- Extra `RouteMeta` keys are allowed (`[key: string]: unknown`); today `title`
  and `description` are rendered into `<head>`.
- Values ride the SSR payload, so the document title updates during
  client-side navigation (no reload).
- The `moons create` template ships a placeholder `<title>`; `meta` overrides
  it. Additional tags (analytics etc.) go in `index.html`.
