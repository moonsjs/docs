---
title: Navigation & Search Params
description: Client-side navigation with Link, prefetching, pending UI, search-param parity with loaders, and refresh() after mutations.
---

Moons treats the URL as the source of truth. `Link` turns a plain click into a client-side navigation, `useSearchParams()` reflects exactly the query the server rendered with, and `refresh()` re-runs the current route after a mutation.

## Link

`Link` renders a real `<a href>`. A plain left click is intercepted and becomes a client-side navigation; a modifier click (Ctrl/Cmd/Shift/Alt), a middle or right click, or a link whose `target` is not `_self` is left to the browser, exactly like a normal anchor. For destinations outside your app, use a plain `<a>`.

```tsx
// src/routes/blog/index.tsx
import { Link } from "@moonsjs/react";

export default function BlogIndex() {
  return (
    <nav>
      <Link to="/blog/[slug]" params={{ slug: "hello-world" }} search={{ preview: "1" }}>
        Preview the draft
      </Link>
    </nav>
  );
}
```

- `to` — a route key from your route map (`"/blog/[slug]"`, `"/about"`), not a hand-built URL.
- `params` — values for dynamic segments; required when the route has any, absent otherwise.
- `search` — query values appended to the URL. Accepts strings, numbers, and booleans; a key with value `undefined` is omitted, which is how you clear a param.
- `prefetch` — fetch the target document on hover or focus; defaults to `true`.

## What a client-side navigation does

When a plain click is intercepted, Moons:

1. marks the navigation as pending (see below);
2. uses a fresh prefetch of the target if one exists, otherwise fetches the document with `accept: text/html`;
3. follows HTTP redirects and commits the final URL to history, so the address bar shows where the redirect landed;
4. swaps the rendered content into the page, hydrates it, applies the new document's metadata, and pushes a history entry;
5. scrolls to the top — or to the `#fragment` target if the URL has one.

If the response is not ok — a 404 or a server error — the client falls back to a full document load, so boundary pages render exactly as they do on a first visit. Because the tree is re-hydrated on every navigation, component `useState` does not survive; keep durable UI state in the URL or in loader data.

## Prefetching

Hovering or focusing a `Link` starts a background fetch of the target document. The result is cached for about ten seconds and consumed by the next click on that link, which makes the navigation feel immediate; repeated hovers do not fetch twice, and failures are ignored. Prefetching applies to internal destinations only. Set `prefetch={false}` to opt out.

## Pending state

```tsx
import { useNavigation } from "@moonsjs/react";

export function Progress() {
  const { pending, url } = useNavigation();
  return pending ? <p role="status">Loading {url}</p> : null;
}
```

`useNavigation()` returns a `NavigationState`: `{ pending: boolean; url: string | null }`. While a navigation is in flight, `url` is the target; otherwise it is `null`. On the server the snapshot is always `pending: false`, so the first HTML and the first client render match.

## Search params

Loaders read the query string from `req` (see [Loaders](/core-concepts/loaders)); components read it with `useSearchParams()`:

```tsx
const params = useSearchParams();
const status = params["status"] ?? "all";
```

The hook returns a plain `Record<string, string>` — not a `URLSearchParams` — carrying the query values the server received, delivered through the SSR payload. During hydration and after every client-side navigation it holds exactly the values the loader saw, which is why you should not read `window.location` yourself.

```tsx
// src/routes/posts.tsx
import { Link, useLoaderData, useSearchParams, type LoaderArgs } from "@moonsjs/react";

const POSTS = [
  { id: "p1", title: "First post", status: "open" },
  { id: "p2", title: "Second post", status: "done" },
];

export const loader = async ({ req }: LoaderArgs<"/posts">) => {
  const status = new URL(req.url).searchParams.get("status") ?? "all";
  return { posts: POSTS.filter((post) => status === "all" || post.status === status) };
};

export default function Posts() {
  const { posts } = useLoaderData<typeof loader>();
  const status = useSearchParams()["status"] ?? "all";
  return (
    <main>
      <nav>
        <Link to="/posts">All</Link>{" "}
        <Link to="/posts" search={{ status: "open" }}>Open</Link>{" "}
        <Link to="/posts" search={{ status: "done" }}>Done</Link>
      </nav>
      <p>Showing: {status}</p>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </main>
  );
}
```

## refresh() after a mutation

After a successful `serverFn` call (see [serverFn](/core-concepts/server-fn)), re-run the current URL so loaders produce fresh data:

```tsx
import { refresh } from "@moonsjs/react";
import { publishPost } from "../server/posts.server";

async function onPublish(id: string) {
  await publishPost({ input: { id } });
  refresh();
}
```

`refresh()` re-runs the current URL through the same document pipeline used for navigation, so the server renders fresh loader data and the page updates without a full reload. Your scroll position is kept, and a prefetched copy of the current URL is discarded so you never re-render stale data.

## Back and forward

Browser back and forward remain real history navigations. On popstate, Moons re-runs the stored URL through the document pipeline and restores the scroll position it saved before you left that page; a newly opened destination starts at the top.
