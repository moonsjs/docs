---
title: Migrating from Next.js
description: Map App Router and Pages Router concepts to Moons, port a small posts app step by step, and see what the framework deliberately leaves out.
---

Next.js and Moons agree on more than they differ: React components, file-based routing, server rendering, hydration, and a document that arrives with its data already in it. The migration is mostly a change of contract — where the server/client boundary lives, and what may cross it.

That contract is a file name. `*.server.ts` files are server-only and are replaced by typed RPC stubs in the client build; anything that tries to move server code into a browser module fails the build. Everything below follows from that one rule ([Zero-Trust Model](/core-concepts/zero-trust), [Architecture](/architecture)).

## Concept mapping

| Next.js — App Router | Next.js — Pages Router | Moons |
| --- | --- | --- |
| `app/layout.tsx` | `_app.tsx` + `_document.tsx` | `src/routes/_layout.tsx`; directories nest layouts root to leaf. The document shell is `index.html`. |
| `app/posts/page.tsx` | `pages/posts/index.tsx` | `src/routes/posts/index.tsx` — the file name is the URL segment; `index.tsx` maps to the directory itself. |
| `app/posts/[slug]/page.tsx` | `pages/posts/[slug].tsx` | `src/routes/posts/[slug].tsx`; the route key is `/posts/[slug]`. |
| Async server component with a direct data call | `getServerSideProps` | `export const loader` on a page or layout; it runs on the server for the first render and for every client-side navigation. |
| `generateStaticParams` | `getStaticPaths` | `export const prerender = true` + `export const paths` on a dynamic route. |
| `export const revalidate = 60` | `revalidate` from `getStaticProps` | `prerender = true` + `revalidate = 60`; multiple instances share state through `isr.storage`. |
| Server Actions (`"use server"`) | API route plus a client `fetch` | `serverFn` in `*.server.ts` + `refresh()`; a raw fallback in `src/api` keeps the no-JavaScript path. |
| `app/api/posts/route.ts` | `pages/api/posts.ts` | `src/api/posts.ts` with one exported function per HTTP method. |
| `redirect()` / `notFound()` from `next/navigation` | `redirect` and a 404 response from a data function | `redirect()` / `notFound()` from `@moonsjs/react`, called from `loader` or `meta`. |
| `generateMetadata` / `export const metadata` | `next/head` | `export const meta: RouteMetaFn<typeof loader>` — `title`, `description`, and the `og:` pair derived from them. |
| `middleware.ts` | `middleware.ts` | Global `middleware` in `moons.config.ts`; per-directory `_middleware.ts` in the routes and API trees. |
| `cookies()` / `headers()` | `req.cookies` / `req.headers` in data functions | `context(req)` in `moons.config.ts` produces `ctx`; `req` is also passed to loaders and API handlers. |
| `next/link`; `useRouter().push` (`next/navigation`) | `next/link`; `useRouter().push` (`next/router`) | `Link to="/posts/[slug]" params={{ slug }}`; `navigate("/posts?status=open")`. |
| `useSearchParams()` | `router.query` | `useSearchParams()` in components, `new URL(req.url).searchParams` in loaders — the same values on both sides. |
| `next build` + `next start`; Vercel and edge adapters | same | `moons build` + `moons start` (Bun or Node); static hosting for prerendered paths; Docker. |

Package-level references live in [@moonsjs/core](/api/core), [@moonsjs/server](/api/server), and [@moonsjs/react](/api/react); the Vite plugin and its leak canary are documented in [@moonsjs/vite](/api/vite).

## Migrating a posts app

The example is a small posts section: a list page with a create form, a dynamic detail page with metadata and a 404, and a JSON endpoint. Each step shows the Next.js code first, then the Moons version.

### 1. Routes and layouts

Next.js names pages with `page.tsx` and layouts with `layout.tsx`. Moons uses the file name itself as the URL segment, and `_layout.tsx` for nested shells:

```tsx
// app/layout.tsx (Next.js App Router)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// src/routes/_layout.tsx (Moons)
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children?: ReactNode }) {
  return <main>{children}</main>;
}
```

The document chrome — `<html>`, `<head>`, and the script that hydrates the app — lives in `index.html`, not in a layout. Links change shape too: `to` is a route key, not a hand-built URL.

```tsx
// app/posts/page.tsx (Next.js)
import Link from "next/link";

export default function PostsPage() {
  return <Link href="/posts/hello">Hello world</Link>;
}
```

```tsx
// src/routes/posts/index.tsx (Moons)
import { Link } from "@moonsjs/react";

export default function PostsPage() {
  return (
    <Link to="/posts/[slug]" params={{ slug: "hello" }}>
      Hello world
    </Link>
  );
}
```

Route keys and file names are covered in [Routing](/core-concepts/routing); a full first page is in [Your First App](/getting-started/first-app).

### 2. Data loading

A Next.js server component can call a data module directly. In Moons the page is a client module, so data arrives through a `loader`, and the data module is a `*.server.ts` file whose exports are `serverFn` definitions:

```ts
// src/shared/posts.ts — client-safe: schemas may be public
import { z } from "zod";

export const postInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
});

export const postSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
});

export const postListSchema = z.array(postSchema);
```

```ts
// src/server/posts.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";
import { postInput, postListSchema, postSchema } from "../shared/posts";

type Post = z.infer<typeof postSchema>;

const posts = new Map<string, Post>([
  ["hello", { id: "hello", title: "Hello world", slug: "hello" }],
]);

export const listPosts = serverFn({
  input: z.object({}),
  output: postListSchema,
  handler: async () => [...posts.values()],
});

export const getPost = serverFn({
  input: z.object({ slug: z.string().min(1) }),
  output: postSchema.nullable(),
  handler: async ({ input }) => posts.get(input.slug) ?? null,
});

export const createPost = serverFn({
  input: postInput,
  output: postSchema,
  handler: async ({ input }) => {
    const slug = input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const post: Post = { id: crypto.randomUUID(), title: input.title, slug };
    posts.set(slug, post);
    return post;
  },
});
```

```tsx
// src/routes/posts/index.tsx
import { useLoaderData } from "@moonsjs/react";
import { listPosts } from "../../server/posts.server";

export const loader = async () => ({ posts: await listPosts({ input: {} }) });

export default function PostsPage() {
  const { posts } = useLoaderData<typeof loader>();
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

From the loader, the `serverFn` call is in-process: no HTTP, and the handler body stays on the server. From a browser component the same import is an RPC stub. Loader results are serialized with devalue and embedded in the HTML, which is why the return value must be public — see [Loaders](/core-concepts/loaders) and [serverFn](/core-concepts/server-fn).

### 3. Dynamic routes, notFound, and metadata

`generateMetadata` becomes one `meta` export typed against the loader's data, and `notFound()` moves into the loader:

```tsx
// app/posts/[slug]/page.tsx (Next.js)
import { notFound } from "next/navigation";
import { getPost } from "@/lib/posts";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  return { title: post?.title ?? "Not found" };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (post === null) notFound();
  return <h1>{post.title}</h1>;
}
```

```tsx
// src/routes/posts/[slug].tsx (Moons)
import { notFound, useLoaderData, type LoaderArgs, type RouteMetaFn } from "@moonsjs/react";
import { getPost } from "../../server/posts.server";

export const loader = async ({ params }: LoaderArgs<"/posts/[slug]">) => {
  const post = await getPost({ input: { slug: params.slug } });
  if (post === null) notFound();
  return { post };
};

export const meta: RouteMetaFn<typeof loader> = ({ data }) => ({
  title: `${data.post.title} — Posts`,
  description: `Read ${data.post.title}.`,
});

export default function PostPage() {
  const { post } = useLoaderData<typeof loader>();
  return <h1>{post.title}</h1>;
}
```

`params.slug` is typed from the route key, and `notFound()` returns `never`, so TypeScript narrows `post` to a non-null value after the check. `notFound()` renders `_404.tsx` with a 404 status; `redirect(to, status?)` issues an HTTP redirect instead. Both are imported from `@moonsjs/react`.

`generateStaticParams` becomes a second pair of exports: `prerender = true` writes the document at build time and `paths()` lists the param objects. `revalidate`, if present, turns those documents into ISR entries ([Prerender & ISR](/guides/prerender-and-isr)).

### 4. Mutations

A Server Action plus `revalidatePath` becomes three moves: validate against the shared schema, call the `serverFn`, then call `refresh()`:

```ts
// app/actions.ts (Next.js)
"use server";

import { revalidatePath } from "next/cache";
import { createPost } from "@/lib/posts";

export async function createPostAction(formData: FormData) {
  await createPost(String(formData.get("title") ?? ""));
  revalidatePath("/posts");
}
```

```tsx
// app/posts/page.tsx (Next.js)
import { createPostAction } from "../actions";

// ...
<form action={createPostAction}>
  <input name="title" required />
  <button type="submit">Add post</button>
</form>
```

```tsx
// src/routes/posts/index.tsx (Moons)
import { refresh, useLoaderData, useNavigation } from "@moonsjs/react";
import { useState, type FormEvent } from "react";
import { createPost, listPosts } from "../../server/posts.server";
import { postInput } from "../../shared/posts";

export const loader = async () => ({ posts: await listPosts({ input: {} }) });

export default function PostsPage() {
  const { posts } = useLoaderData<typeof loader>();
  const { pending } = useNavigation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = postInput.safeParse({ title: new FormData(form).get("title") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createPost({ input: parsed.data });
      form.reset();
      refresh();
    } catch {
      setError("Could not save the post.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <form action="/api/posts" method="post" onSubmit={(event) => void onCreate(event)}>
        <input name="title" maxLength={120} required />
        <button type="submit" disabled={saving || pending}>
          {saving || pending ? "Saving..." : "Add post"}
        </button>
      </form>
      {error !== null && <p role="alert">{error}</p>}
      <ul>
        {posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </main>
  );
}
```

The client-side `safeParse` skips a round trip for obvious mistakes, but it is not the security boundary: the RPC stub and the server both validate the same schema, and the handler runs only after the server check passes. `refresh()` re-runs the current URL through the document pipeline, so the loader executes again on the server and the list is re-rendered without a full reload ([Navigation & Search Params](/core-concepts/navigation)). The full form pattern, including pending and error handling, is in [Forms & Mutations](/guides/forms).

`revalidatePath` has no direct equivalent: other visitors see fresh loader data on their next request because loaders always run per request, and a prerendered document waits for its `revalidate` window.

### 5. API endpoints

A route handler becomes a `src/api` module with one exported function per HTTP method. The `POST` below is also the no-JavaScript fallback for the form above:

```ts
// app/api/posts/route.ts (Next.js)
export async function GET() {
  return Response.json({ count: 1 });
}
```

```ts
// src/api/posts.ts (Moons)
import { type ApiHandlerArgs } from "@moonsjs/server";
import { createPost, listPosts } from "../server/posts.server";
import { postInput } from "../shared/posts";

export async function GET(): Promise<Response> {
  const posts = await listPosts({ input: {} });
  return Response.json({ count: posts.length });
}

export async function POST({ req }: ApiHandlerArgs): Promise<Response> {
  const form = await req.formData();
  const parsed = postInput.safeParse({ title: form.get("title") });
  if (!parsed.success) {
    return new Response("Title is required.", { status: 400 });
  }
  await createPost({ input: parsed.data });
  return Response.redirect(new URL("/posts", req.url), 303);
}
```

Handlers receive `{ req, params, ctx }` and return a standard `Response`; `HEAD` is derived from `GET`, `OPTIONS` answers `204`, and a missing method returns `405`. Raw endpoints are public by default — no origin check, no `security.bodyLimitBytes` — so verify tokens and signatures in the handler or in `src/api/_middleware.ts` ([API Routes](/guides/api-routes)).

### 6. Middleware

A Next.js `middleware.ts` with a `matcher` becomes either global middleware in `moons.config.ts` or a `_middleware.ts` file in a directory that needs it:

```ts
// src/routes/admin/_middleware.ts
import type { MiddlewareArgs } from "@moonsjs/core";

export default async function admin({ ctx, next }: MiddlewareArgs): Promise<Response> {
  if (ctx.user === null) {
    return new Response(null, { status: 302, headers: { location: "/login" } });
  }
  return next();
}
```

Two differences matter for security. Directory middleware does not run for RPC calls — only the global chain does — so a `serverFn` handler must check the session itself. And in production, static files are served before the pipeline, so middleware never runs for a prerendered page; keep protected pages on request-time rendering. [Middleware](/guides/middleware) and [Authentication](/guides/authentication) cover both patterns.

## Caching and ISR

Next.js caches data (`fetch` options, `unstable_cache`, tags) and can invalidate it on demand (`revalidateTag`, `revalidatePath`). Moons has no data cache: loaders run on every request, so list pages are always fresh and there is nothing to invalidate by tag.

What Moons does cache is documents. `prerender = true` writes HTML at build time, and `revalidate` adds ISR expiry with optional shared storage across instances ([Prerender & ISR](/guides/prerender-and-isr)). Static assets under `/assets/*` are served with long-lived cache headers; SSR and API responses are not cached by the built-in server ([Deployment](/guides/deployment)). When a layout loader and a page loader need the same value, dedupe it per request with the `cache()` helper instead of a cross-request cache ([Context & Environment](/core-concepts/context-and-environment)).

## What Moons deliberately does not do

This is the honest part of the migration. Moons is not a smaller Next.js with a different config file; it is a framework built around one guarantee: server code cannot leak into the client bundle, and an attempt fails the build. Every item below moves application code across that line or hides where it runs, so it is refused, not scheduled.

- **No React Server Components.** There is no `"use client"` boundary and no async component. Server-only code lives in `*.server.ts` and is reached through `serverFn`; page data comes from loaders.
- **No streaming SSR or Suspense data APIs.** No `loading.tsx`, no `<Suspense>` data boundaries, no `use()`, no `defer()`. The document is rendered completely before it is sent; pending UI comes from `useNavigation()`.
- **No form actions.** There is no `action={...}` server function and no framework-managed form state. The pattern is client validation plus a `serverFn` call plus `refresh()`; a native form posting to `src/api` keeps the no-JavaScript path.
- **No built-in auth or sessions.** There is no user store, login flow, or session table. Read a signed cookie in `context(req)`, expose it on `ctx`, and guard loaders and handlers ([Authentication](/guides/authentication)).
- **No ORM.** Bring your own driver in a `*.server.ts` module and query it through `serverFn` ([Working with Databases](/guides/databases)).
- **No edge or serverless adapter.** `moons build` produces `dist/client` plus a `node:http` server entry that runs on Bun and Node; prerendered paths can be served by a plain static host. There is no per-platform adapter package.
- **No image or font optimization.** No `next/image` or `next/font`. Use `<img>` with explicit dimensions, CSS, and self-hosted or system fonts; static files live in `dist/client`.

The replacement pattern is always the same three moves: load with a `loader`, mutate with a `serverFn`, re-render with `refresh()`. [Architecture](/architecture) explains why the boundary is drawn this way; [Zero-Trust Model](/core-concepts/zero-trust) covers what stays your responsibility.

## Gotchas

- **`*.server.ts` is the contract.** Server-only code must carry the suffix (or live under `src/server/**`), because the transform keys off the name. A helper named `db.ts` outside those locations is client code as far as the build is concerned.
- **Schemas are public.** The client stub carries the `input` and `output` schemas so it can validate before and after the request. Treat literal values and messages as public, and put sensitive checks in the handler.
- **Loader data is embedded in the HTML.** It is public the moment the page renders. Never return secrets, tokens, or private records from a loader; do credential work in `serverFn` and return only what the page displays.
- **Raw `src/api` routes do their own origin and CSRF checks.** The RPC transport requires `x-moons: 1` and checks `Origin`; raw endpoints get none of that. Verify tokens, signatures, or sessions in the handler or API middleware.
- **`refresh()` re-runs the current URL, and component state does not survive it.** The tree is re-hydrated on every document swap, so `useState` is re-created. Keep durable UI state in the URL or in loader data; don't patch local state and refresh the same list twice.
- **`Link` takes route patterns, not URL paths.** `to="/posts/[slug]"` plus `params`; `navigate()` is the one that takes a URL path.
- **Search params must come from the framework.** Loaders read `new URL(req.url).searchParams`, components read `useSearchParams()`. Both are fed from the same request, so they always agree; reading `window.location` breaks hydration parity.
- **Route exports are validated.** Pages may export `default`, `loader`, `meta`, `prerender`, `paths`, and `revalidate`; layouts only `default` and `loader`. A stray helper in a route file fails the build with `E_ROUTE_EXPORT_INVALID`.
- **Next.js conventions have no echo here.** `page.tsx`, `layout.tsx`, `template.tsx`, parallel routes (`@slot`), intercepting routes, and optional catch-alls (`[[...slug]]`) do not exist. Two files that resolve to the same URL fail the build.

## Checklist

Done when:

- `moons check` is green — typegen, `tsc --noEmit`, the client and server builds, and the prerender pass.
- `moons audit` reports `0 fail`; pass `--canary <value>` so the `dist/client` scan includes your leak canary.
- No handler body, `env()` secret, or canary value appears anywhere in `dist/client`.
- Loader return values contain nothing you would not put in the page source.
- Every raw `src/api` endpoint verifies its own caller.
- Migrated routes have tests before you delete the Next.js app ([Testing](/guides/testing), [@moonsjs/cli](/api/cli) for `moons test`).

Next: [Migrating from Remix + React Router v7](/guides/migrating-from-remix) covers the same migration from the other side, and [Your First App](/getting-started/first-app) is the fastest way to see the loader plus `serverFn` loop end to end.
