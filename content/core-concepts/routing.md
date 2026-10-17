---
title: Routing
description: File conventions, dynamic params, nested layouts, navigation signals, and error boundaries.
---

Routes are files. A file in `src/routes` becomes a URL automatically, and the special filenames in the tree — `_layout.tsx`, `_error.tsx`, `_404.tsx` — add structure and boundaries around your pages.

## File conventions

| File | URL |
| --- | --- |
| `src/routes/index.tsx` | `/` |
| `src/routes/about.tsx` | `/about` |
| `src/routes/blog/[slug].tsx` | `/blog/:slug` |
| `src/routes/docs/[...rest].tsx` | `/docs/*` |
| `src/routes/(marketing)/pricing.tsx` | `/pricing` |

- `[slug]` is a dynamic segment; the value becomes a param.
- `[...rest]` is a catch-all. It matches one or more segments, but only as the final segment of a path.
- `(marketing)` is a group. Folders in parentheses never appear in the URL; they only organize files and can own their own layout.
- `_middleware.ts` adds [middleware](/guides/middleware) for a directory and everything below it.

Two files that resolve to the same URL fail the build with `E_ROUTE_CONFLICT`. There is no fallback, so rename one of them — for example, give one dynamic segment a different name like `[uid]`.

Every page module may export:

- `default` — the React component (required).
- `loader` — runs on the server and provides data to the page.
- `meta` — sets `title` and `description` for the document.

Layouts export `default` and optionally `loader`. `_error.tsx` and `_404.tsx` export only `default`. Anything else fails the build with `E_ROUTE_EXPORT_INVALID`, so a helper function accidentally left in a route file is caught immediately.

## Nested layouts

A `_layout.tsx` wraps every page below its directory. Root layout first, then deeper layouts, then the page — the chain nests from root to leaf.

```tsx
// src/routes/blog/_layout.tsx
import { Link } from "@moonsjs/react";
import type { ReactNode } from "react";

export default function BlogLayout({ children }: { children?: ReactNode }) {
  return (
    <section>
      <nav>
        <Link to="/blog">All posts</Link>
      </nav>
      {children}
    </section>
  );
}
```

Visiting `/blog/hello` renders the root layout, the blog layout, then the post inside it. A layout may also export a `loader`; the result is available to the layout component through `useLoaderData<typeof loader>()`.

## Params

Read params in a component with the typed `useParams`:

```tsx
// src/routes/blog/[slug].tsx
import { useParams } from "@moonsjs/react";

export default function Post() {
  const { slug } = useParams<"/blog/[slug]">();
  return <h1>Post: {slug}</h1>;
}
```

The generic argument is the route key — the file path without the extension. Typegen has already seen it, so `slug` is typed as `string` and a typo in the key becomes a type error.

Link to a dynamic route by passing the route key as `to` and a `params` object:

```tsx
import { Link } from "@moonsjs/react";

export function PostLink() {
  return (
    <Link to="/blog/[slug]" params={{ slug: "hello-world" }}>
      Read the post
    </Link>
  );
}
```

For a catch-all, pass the whole remainder as one string: `params={{ rest: "guides/setup" }}`.

## notFound() and redirect()

Loaders can stop a render with two signals imported from `@moonsjs/react`:

```tsx
// src/routes/blog/[slug].tsx
import { notFound, redirect, type LoaderArgs } from "@moonsjs/react";

const posts: Record<string, { title: string; movedTo?: string }> = {
  hello: { title: "Hello world" },
  old: { title: "Old post", movedTo: "/blog/hello" },
};

export const loader = async ({ params }: LoaderArgs<"/blog/[slug]">) => {
  const post = posts[params.slug];
  if (post === undefined) notFound();
  if (post.movedTo !== undefined) redirect(post.movedTo, 301);
  return { post };
};
```

`notFound()` renders the `_404` page with status 404. `redirect(to, status?)` issues an HTTP redirect — the default status is 302, and 301, 303, 307, and 308 are supported. Relative destinations resolve against the request URL.

## Error boundaries

- `_404.tsx` is root-only. It renders unmatched URLs and `notFound()` results with a 404 status.
- `_error.tsx` may live in any directory. When a page throws, Moons walks up from that page and renders the nearest boundary — so a dashboard can show its own error UI while the rest of the app uses the root one.

```tsx
// src/routes/_error.tsx
import { useRouteError } from "@moonsjs/react";

export default function ErrorPage() {
  const error = useRouteError();
  return (
    <main>
      <h1>Something went wrong</h1>
      {error instanceof Error ? <p>{error.message}</p> : null}
    </main>
  );
}
```

Both boundary files render standalone, without layouts. In production, error details are not included in the response: `useRouteError()` returns `undefined`, so always provide a static fallback message.

Next: [serverFn](/core-concepts/server-fn) shows how pages call server-only code, and [Loaders](/core-concepts/loaders) goes deeper on data loading.
