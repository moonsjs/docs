---
title: Loaders
description: How loader exports run, the LoaderArgs contract, layout loader data, devalue serialization, and the public-data rule.
---

A `loader` gives a route its data. It runs on the server for the first render and again for every client-side navigation, so each URL you visit is rendered with fresh server data rather than stale client state.

## The loader export

Export `loader` from a page or layout module. It receives one argument object, `LoaderArgs`:

```tsx
// src/routes/blog/[slug].tsx
import { type LoaderArgs } from "@moonsjs/react";

export const loader = async ({ params, ctx, req }: LoaderArgs<"/blog/[slug]">) => {
  return {
    slug: params.slug, // typed as string from the route key
    requestId: ctx.requestId,
    preview: new URL(req.url).searchParams.get("preview") === "1",
  };
};
```

- `params` — the dynamic segments of the matched route, typed from the route key (`params.slug` is a `string` here).
- `ctx` — the request context returned by `context(req)` in `moons.config.ts`; see [Context & Environment](/core-concepts/context-and-environment).
- `req` — the incoming `Request`. The query string reaches a loader this way, through `new URL(req.url).searchParams`.

There is deliberately no `searchParams` field on `LoaderArgs`. The browser side reads the same values with `useSearchParams()`; both are fed from the same request and always agree (see [Navigation & Search Params](/core-concepts/navigation)).

Read the result with a hook whose generic is the loader function itself:

```tsx
const data = useLoaderData<typeof loader>();
```

`useLoaderData<typeof loader>()` resolves to the awaited return type of your loader, so every field it returned is fully typed with no cast.

## A complete example

```tsx
// src/routes/blog/[slug].tsx
import { notFound, useLoaderData, type LoaderArgs } from "@moonsjs/react";

type Post = { title: string; body: string; publishedAt: Date };

const posts = new Map<string, Post>([
  [
    "hello-world",
    {
      title: "Hello world",
      body: "The first post.",
      publishedAt: new Date("2024-01-01T00:00:00Z"),
    },
  ],
]);

export const loader = async ({ params, req }: LoaderArgs<"/blog/[slug]">) => {
  const post = posts.get(params.slug);
  if (post === undefined) notFound();
  return {
    post,
    preview: new URL(req.url).searchParams.get("preview") === "1",
  };
};

export default function BlogPost() {
  const { post, preview } = useLoaderData<typeof loader>();
  return (
    <article>
      <h1>{post.title}</h1>
      {preview ? <p>Draft preview</p> : null}
      <time dateTime={post.publishedAt.toISOString()}>
        {post.publishedAt.toDateString()}
      </time>
      <p>{post.body}</p>
    </article>
  );
}
```

Client-side navigation does not call the loader in the browser. The client fetches a freshly rendered document from the server, swaps it in, and hydrates it; loaders execute on the server each time. Local component state is re-created during that swap, so treat loader data as the source of truth and keep durable UI state in the URL.

## Layout loaders

Every layout may export its own loader, and all loaders for a matched URL — each layout in the chain plus the page — run in parallel. A component always reads the loader of the module it lives in: `useLoaderData<typeof loader>()` inside `_layout.tsx` returns the layout's data, while the same call in the page returns the page's data. The page cannot read its parent layout's result, and because the loaders run in parallel you cannot build one on top of the other. When a layout and a page both need the same expensive value, route both through one `serverFn` and dedupe the work with the request-scoped `cache()` helper (see [Context & Environment](/core-concepts/context-and-environment)).

## What survives serialization

Loader return values are serialized with devalue and embedded in the document as the payload hydration reads. Round-trips preserve `Date`, `Map`, `Set`, `BigInt`, `undefined`, `NaN`, and `RegExp`; in the example above, `publishedAt` arrives in the browser as a real `Date` that still has methods. Values devalue cannot represent fail the render instead of disappearing silently: functions throw `Cannot stringify a function`, class instances throw `Cannot stringify arbitrary non-POJOs`, and symbols are refused. The request then renders the nearest `_error` boundary with a 500 status (see [Error Handling](/core-concepts/error-handling)). Stick to plain objects, arrays, and the built-ins above.

## Loader data is public

The serialized result ships inside the HTML in the `__moons_data` script element, so treat loader output as public: anyone can read it with View Source. Never return secrets, tokens, or private records; do credential work in a `serverFn` handler (see [serverFn](/core-concepts/server-fn)) and return only what the page may display. The same applies to loader code — route modules are part of the browser bundle, so a literal API key written in a route file leaks even if only the loader reads it.

## Errors and signals from loaders

- A thrown error renders the nearest `_error` boundary.
- `notFound()` renders `_404` with status 404; `redirect(to, status?)` returns an HTTP redirect.
- Returning a `Response` is invalid: Moons throws `E_INTERNAL` with the message ``loader returned a `Response` `` and points you to plain data, or to middleware for status and headers.

After a mutation, re-run the current route's loaders with `refresh()` — see [Navigation & Search Params](/core-concepts/navigation).
