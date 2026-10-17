---
title: Form Submission + Revalidation
description: Validate a form on both sides, submit it to a server function, refresh the loader, and keep a no-JavaScript fallback working.
---

This recipe follows one form from the browser to the store and back to a fresh list. The JavaScript path uses a server function and `refresh()`; the no-JavaScript path posts to an API route and redirects. Both paths share the same schema and the same mutation.

## What we are building

- `src/shared/posts.ts` defines the post shapes.
- `src/server/posts.server.ts` owns the in-memory store and `createPost`.
- `src/routes/posts.tsx` lists posts and handles the enhanced form.
- `src/api/posts.ts` handles the plain HTML form post.

```ts
// src/shared/posts.ts
import { z } from "zod";

export const postInput = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(2000),
});

export const postSchema = postInput.extend({
  id: z.string(),
  createdAt: z.date(),
});

export const postListSchema = z.array(postSchema);
```

```ts
// src/server/posts.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";
import { postInput, postListSchema, postSchema } from "../shared/posts";

type Post = z.infer<typeof postSchema>;

const posts = new Map<string, Post>();

export const listPosts = serverFn({
  input: z.object({}),
  output: postListSchema,
  handler: async () =>
    [...posts.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    ),
});

export const createPost = serverFn({
  input: postInput,
  output: postSchema,
  handler: async ({ input }) => {
    const post: Post = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date(),
    };
    posts.set(post.id, post);
    return post;
  },
});
```

## The enhanced form

The form keeps a real `action` and `method`, so it still works when JavaScript is unavailable. The `onSubmit` handler takes over when JavaScript is present.

```tsx
// src/routes/posts.tsx
import { refresh, useLoaderData, useNavigation } from "@moonsjs/react";
import { useState } from "react";
import { createPost, listPosts } from "../server/posts.server";
import { postInput } from "../shared/posts";

export const loader = async () => ({
  posts: await listPosts({ input: {} }),
});

export default function PostsPage() {
  const { posts } = useLoaderData<typeof loader>();
  const { pending } = useNavigation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = submitting || pending;

  async function submit(): Promise<void> {
    setError(null);
    const parsed = postInput.safeParse({ title, body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return;
    }

    setSubmitting(true);
    try {
      await createPost({ input: parsed.data });
      setTitle("");
      setBody("");
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the post.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Posts</h1>
      <form
        action="/api/posts"
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          value={title}
          maxLength={80}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label htmlFor="body">Body</label>
        <textarea
          id="body"
          name="body"
          value={body}
          maxLength={2000}
          onChange={(event) => setBody(event.target.value)}
        />
        <button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Create post"}
        </button>
      </form>

      {error !== null ? <p role="alert">{error}</p> : null}
      {pending ? <p role="status">Refreshing the list...</p> : null}

      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.body}</p>
          </li>
        ))}
      </ul>
      {posts.length === 0 ? <p>No posts yet.</p> : null}
    </main>
  );
}
```

## The no-JavaScript fallback

An API handler returns a `Response`, so it can answer a form post with a redirect itself. `redirect()` from `@moonsjs/react` is a signal for loaders and `meta`; it is not the tool for API handlers.

```ts
// src/api/posts.ts
import type { ApiHandlerArgs } from "@moonsjs/server";
import { createPost } from "../server/posts.server";
import { postInput } from "../shared/posts";

export async function POST({ req }: ApiHandlerArgs): Promise<Response> {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  if (origin !== null && origin !== url.origin) {
    return new Response("Bad origin", { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (form === null) {
    return new Response("Invalid form body.", { status: 400 });
  }

  const parsed = postInput.safeParse({
    title: form.get("title"),
    body: form.get("body"),
  });
  if (!parsed.success) {
    return new Response("Check the form and try again.", { status: 400 });
  }

  await createPost({ input: parsed.data });
  return new Response(null, {
    status: 303,
    headers: { location: "/posts" },
  });
}
```

## How it works

The loader calls `listPosts` in-process on the server and returns the array for rendering. When the enhanced form submits, the handler validates with `postInput`, calls `createPost`, and then calls `refresh()`. The server function is an RPC call: the stub validates the input, the server validates it again, runs the handler, and validates the output. `refresh()` then fetches the current URL as a document. The loader runs on the server again, `listPosts` reads the updated `Map`, and the page is rendered and hydrated with the new list. The list is not patched in the browser.

`useNavigation().pending` becomes true while the refresh document is in flight. It does not track the RPC itself, so the local `submitting` flag covers the first leg. `busy` combines both and keeps the button disabled.

Without JavaScript, the browser posts the same fields to `/api/posts`. The handler parses `formData`, validates with the same `postInput`, calls the same `createPost`, and returns `303` with `location: "/posts"`. The browser follows with a GET, the loader runs on the server, and the fresh list is the response. This is the classic post/redirect/get shape: the redirect prevents a reload from submitting the form again.

API routes do not get the RPC header or origin checks, so the handler checks `Origin` itself. If the app sits behind a TLS-terminating proxy, enable `security.trustProxy` so `req.url` reflects the public origin; otherwise a legitimate HTTPS form post can look cross-origin. See [API Routes](/guides/api-routes).

## Notes

The store resets with the process. Replace the `Map` with your database and keep `createPost` as the single mutation path; the [Databases](/guides/databases) guide covers the server-only side.

The `refresh()` path is the default once JavaScript is available. The API route is what makes the form resilient: it uses the same schema and the same function, so the two paths cannot drift. If you only need the JavaScript path, remove the `action` and `method` attributes and keep the handler. If you keep the API route, add a CSRF token for sensitive forms and rate limiting at the edge; an `Origin` check alone is not a complete defense. The fallback returns a plain `400` on invalid input; re-render the form with the issues if you need full parity. [serverFn](/core-concepts/server-fn) covers the RPC contract, and [Navigation & Search Params](/core-concepts/navigation) covers the document pipeline behind `refresh()`.
