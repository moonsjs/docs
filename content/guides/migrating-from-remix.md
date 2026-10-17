---
title: Migrating from Remix + React Router v7
description: Move Remix and React Router v7 loaders, actions, and route modules to Moons, port a notes app, and see what the framework deliberately leaves out.
---

Remix and React Router v7 already have nested routes, server-side `loader` functions, and documents that arrive with their data. Moons keeps the first two ideas and collapses `action` into `serverFn` calls; it also removes the adapter layer, because the built server runs directly on Bun and Node.

The contract that replaces adapters is a file name: `*.server.ts` files are server-only, everything else a route imports is client code, and an attempt to move server code across the line fails the build ([Zero-Trust Model](/core-concepts/zero-trust), [Architecture](/architecture)).

## Concept mapping

| Remix v2 / React Router v7 | Moons |
| --- | --- |
| `app/routes/**` flat-file routes (Remix, or RRv7 with `flatRoutes()`); `app/routes.ts` route config | `src/routes/**`; the file path is the URL. |
| Nested routes with `<Outlet>` | `_layout.tsx` per directory; layouts nest root to leaf around the page. |
| `loader({ request, params })` | `loader({ params, ctx, req })` — same role, different field names. |
| `clientLoader` | None — loaders always run on the server. For an imperative read, call a `serverFn` from the event handler. |
| `action` + `<Form method="post">` | `serverFn` + `refresh()`; a native form posting to `src/api` keeps the no-JavaScript path. |
| `useFetcher` | Call the `serverFn` directly and keep local state; `refresh()` re-syncs the route afterwards. |
| `useRevalidator` / `shouldRevalidate` | `refresh()` re-runs the current URL's loaders. There is no per-route revalidation control. |
| `redirect()` | `redirect()` from `@moonsjs/react`, called from `loader` or `meta`. |
| `json()` / `data()`; `throw new Response("...", { status: 404 })` | Return plain objects (devalue handles `Date`, `Map`, `Set`); `notFound()` for 404s. Returning a `Response` from a loader is an error. |
| `ErrorBoundary` export | `_error.tsx` in any route directory; the nearest boundary wins. |
| `meta` export | `meta: RouteMetaFn<typeof loader>` — `title`, `description`, and the `og:` pair derived from them. |
| `links` export | No per-route style links; load global CSS and fonts from `index.html` or the client entry. |
| Resource route (no component) | `src/api/**` method handlers under `/api`. |
| `$.tsx` splat route | `[...rest].tsx` catch-all. |
| `headers` export | `setHeader()` from a loader or middleware. |
| Cookie session helpers (`createCookieSessionStorage`) | No session system; `signCookie` / `verifyCookie` in `context` ([Authentication](/guides/authentication)). |
| `defer()` + `<Await>` | No streaming; loader data is complete before the document is sent. |
| `useNavigation()` (`state`, `formData`) | `useNavigation()` returns `{ pending, url }` and covers document navigations, not the RPC call itself. |
| `useSearchParams()` | `useSearchParams()` — a plain `Record<string, string>` fed by the SSR payload. |
| Deploy adapters (`@remix-run/node`, `@react-router/node`, Cloudflare, Netlify) | `moons build` + `moons start` on Bun or Node; static hosting for prerendered paths. |

Package-level references live in [@moonsjs/core](/api/core), [@moonsjs/server](/api/server), and [@moonsjs/react](/api/react); the Vite plugin is documented in [@moonsjs/vite](/api/vite).

## Migrating a notes app

The example is the classic notes section: a list page with a create form, a detail route, and a resource route that returns JSON. Remix v2 syntax is shown first; in React Router v7 framework mode the same exports come from `react-router` and the route table comes from `app/routes.ts`.

### 1. Route files and layout

Remix dot-delimited route files become directories with real file names. `<Outlet>` becomes `children` in a `_layout.tsx`:

```tsx
// app/routes/notes.tsx (Remix)
import { Link, Outlet } from "@remix-run/react";

export default function NotesLayout() {
  return (
    <section>
      <nav>
        <Link to="/notes">All notes</Link>
      </nav>
      <Outlet />
    </section>
  );
}
```

```tsx
// src/routes/notes/_layout.tsx (Moons)
import { Link } from "@moonsjs/react";
import type { ReactNode } from "react";

export default function NotesLayout({ children }: { children?: ReactNode }) {
  return (
    <section>
      <nav>
        <Link to="/notes">All notes</Link>
      </nav>
      {children}
    </section>
  );
}
```

The route file names change shape: `notes._index.tsx` becomes `src/routes/notes/index.tsx`, and `notes.$id.tsx` becomes `src/routes/notes/[id].tsx`, whose route key is `/notes/[id]`. Links use the route key plus a typed `params` object instead of an interpolated path ([Routing](/core-concepts/routing)).

### 2. Loaders

The loader export survives, but `json()` does not: return a plain object. `request` becomes `req`, and `ctx` joins the arguments:

```tsx
// app/routes/notes._index.tsx (Remix)
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { listNotes } from "~/models/notes.server";

export async function loader() {
  return json({ notes: await listNotes() });
}

export default function NotesPage() {
  const { notes } = useLoaderData<typeof loader>();
  return <ul>{notes.map((note) => <li key={note.id}>{note.title}</li>)}</ul>;
}
```

```tsx
// src/routes/notes/index.tsx (Moons)
import { useLoaderData } from "@moonsjs/react";
import { listNotes } from "../../server/notes.server";

export const loader = async () => ({ notes: await listNotes({ input: {} }) });

export default function NotesPage() {
  const { notes } = useLoaderData<typeof loader>();
  return (
    <ul>
      {notes.map((note) => (
        <li key={note.id}>{note.title}</li>
      ))}
    </ul>
  );
}
```

The loader calls `listNotes`, a `serverFn` declared in a `*.server.ts` module. During server rendering that call is in-process; the same import in the browser is an RPC stub, so the store and its data module never reach the client. Loader results are serialized with devalue — `Date`, `Map`, `Set`, `BigInt`, and `undefined` survive — and embedded in the HTML, so they must be public ([Loaders](/core-concepts/loaders), [serverFn](/core-concepts/server-fn)).

### 3. Actions and forms

An `action` export disappears. Its replacement is a shared schema, a `serverFn`, and `refresh()` after the call:

```tsx
// app/routes/notes._index.tsx (Remix)
import { Form, useLoaderData } from "@remix-run/react";
import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { addNote, listNotes } from "~/models/notes.server";

export async function loader() {
  return json({ notes: await listNotes() });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  await addNote(String(form.get("title") ?? ""));
  return redirect("/notes");
}

export default function NotesPage() {
  const { notes } = useLoaderData<typeof loader>();
  return (
    <main>
      <Form method="post">
        <input name="title" required />
        <button type="submit">Add note</button>
      </Form>
      <ul>{notes.map((note) => <li key={note.id}>{note.title}</li>)}</ul>
    </main>
  );
}
```

```ts
// src/shared/schemas.ts (Moons) — client-safe: schemas may be public
import { z } from "zod";

export const addNoteInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(80),
});

export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.date(),
});

export const noteListSchema = z.array(noteSchema);
```

```ts
// src/server/notes.server.ts (Moons)
import { serverFn } from "@moonsjs/server";
import { z } from "zod";
import { addNoteInput, noteListSchema, noteSchema } from "../shared/schemas";

type Note = z.infer<typeof noteSchema>;

const notes = new Map<string, Note>([
  [
    "welcome",
    { id: "welcome", title: "Welcome to Moons", createdAt: new Date("2026-01-01T00:00:00Z") },
  ],
]);

export const listNotes = serverFn({
  input: z.object({}),
  output: noteListSchema,
  handler: async () => [...notes.values()],
});

export const getNote = serverFn({
  input: z.object({ id: z.string().min(1) }),
  output: noteSchema.nullable(),
  handler: async ({ input }) => notes.get(input.id) ?? null,
});

export const addNote = serverFn({
  input: addNoteInput,
  output: noteSchema,
  handler: async ({ input }) => {
    const note: Note = { id: crypto.randomUUID(), title: input.title, createdAt: new Date() };
    notes.set(note.id, note);
    return note;
  },
});
```

```tsx
// src/routes/notes/index.tsx (Moons)
import { refresh, useLoaderData, useNavigation } from "@moonsjs/react";
import { useState, type FormEvent } from "react";
import { addNote, listNotes } from "../../server/notes.server";
import { addNoteInput } from "../../shared/schemas";

export const loader = async () => ({ notes: await listNotes({ input: {} }) });

export default function NotesPage() {
  const { notes } = useLoaderData<typeof loader>();
  const { pending } = useNavigation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = addNoteInput.safeParse({ title: new FormData(form).get("title") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addNote({ input: parsed.data });
      form.reset();
      refresh();
    } catch {
      setError("Could not save the note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <form action="/api/notes" method="post" onSubmit={(event) => void onCreate(event)}>
        <input name="title" maxLength={80} required />
        <button type="submit" disabled={saving || pending}>
          {saving || pending ? "Saving..." : "Add note"}
        </button>
      </form>
      {error !== null && <p role="alert">{error}</p>}
      <ul>
        {notes.map((note) => (
          <li key={note.id}>{note.title}</li>
        ))}
      </ul>
    </main>
  );
}
```

The form keeps a real `action` and `method`, so it still works without JavaScript — the POST goes to a resource-route replacement under `src/api`, which reuses the same `serverFn` and redirects:

```ts
// app/routes/api.notes.tsx (Remix resource route)
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { addNote } from "~/models/notes.server";

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  await addNote(String(form.get("title") ?? ""));
  return json({ ok: true });
}
```

```ts
// src/api/notes.ts (Moons)
import { type ApiHandlerArgs } from "@moonsjs/server";
import { addNote } from "../server/notes.server";
import { addNoteInput } from "../shared/schemas";

export async function POST({ req }: ApiHandlerArgs): Promise<Response> {
  const form = await req.formData();
  const parsed = addNoteInput.safeParse({ title: form.get("title") });
  if (!parsed.success) {
    return new Response("Title is required.", { status: 400 });
  }
  await addNote({ input: parsed.data });
  return Response.redirect(new URL("/notes", req.url), 303);
}
```

The client `safeParse` is a convenience, not the security boundary: the stub validates before the request and the server validates again before the handler, so a malformed call never reaches the store. `refresh()` re-runs the current URL through the document pipeline, so the loader executes on the server and the list re-renders without a full reload ([Forms & Mutations](/guides/forms), [Navigation & Search Params](/core-concepts/navigation)). Note that raw endpoints carry no RPC origin check; add your own session or CSRF check before relying on the fallback ([API Routes](/guides/api-routes)).

### 4. 404s and error boundaries

`throw new Response(..., { status: 404 })` becomes `notFound()`, and `ErrorBoundary` becomes a file. The nearest `_error.tsx` up the directory chain renders when a loader or the page throws; `_404.tsx` is root-only and also handles unmatched URLs:

```tsx
// app/routes/notes.$id.tsx (Remix)
import { useLoaderData, useRouteError, isRouteErrorResponse, type MetaFunction } from "@remix-run/react";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getNote } from "~/models/notes.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const note = await getNote(params.id);
  if (note === null) throw new Response("Not found", { status: 404 });
  return json({ note });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.note.title ?? "Note" },
];

export default function NotePage() {
  const { note } = useLoaderData<typeof loader>();
  return <h1>{note.title}</h1>;
}

export function ErrorBoundary() {
  const error = useRouteError();
  return <h1>{isRouteErrorResponse(error) ? error.status : "Something went wrong"}</h1>;
}
```

```tsx
// src/routes/notes/[id].tsx (Moons)
import { notFound, useLoaderData, type LoaderArgs, type RouteMetaFn } from "@moonsjs/react";
import { getNote } from "../../server/notes.server";

export const loader = async ({ params }: LoaderArgs<"/notes/[id]">) => {
  const note = await getNote({ input: { id: params.id } });
  if (note === null) notFound();
  return { note };
};

export const meta: RouteMetaFn<typeof loader> = ({ data }) => ({
  title: `${data.note.title} — Notes`,
});

export default function NotePage() {
  const { note } = useLoaderData<typeof loader>();
  return <h1>{note.title}</h1>;
}
```

```tsx
// src/routes/_error.tsx (Moons)
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

In production, error details are stripped from the response and `useRouteError()` returns `undefined`, so always ship a static fallback message. `notFound()` renders `_404.tsx` with a 404 status; `redirect(to, status?)` supports `301`, `302`, `303`, `307`, and `308` ([Routing](/core-concepts/routing)).

### 5. Meta and headers

The `meta` export keeps its name but returns one object instead of an array, typed against loader data. `title` and `description` map to the document head and the `og:` pair; there is no tag-by-tag head API:

```tsx
// app/routes/notes._index.tsx (Remix)
export const meta = () => [{ title: "Notes" }];
```

```tsx
// src/routes/notes/index.tsx (Moons) — same module as the loader
import { type RouteMetaFn } from "@moonsjs/react";

export const meta: RouteMetaFn<typeof loader> = ({ data }) => ({
  title: `Notes — ${data.notes.length} saved`,
  description: "All notes in the workspace.",
});
```

A Remix `headers` export becomes a `setHeader()` call in the loader or in middleware; response helpers apply to the final response:

```tsx
// src/routes/notes/index.tsx (Moons) — inside the loader
import { setHeader } from "@moonsjs/react";

export const loader = async () => {
  setHeader("cache-control", "no-store");
  return { notes: await listNotes({ input: {} }) };
};
```

Routes that need their own HTTP headers, redirects, or bodies (files, XML, uploads) belong in `src/api` instead.

## Revalidation and caching

Remix gives you `shouldRevalidate` and `useRevalidator` to control when loaders re-run. Moons has one lever: `refresh()` re-runs every loader for the current URL after a mutation. There is no per-route opt-out, no tag system, and no client-side cache to keep coherent: loaders execute on the server for the first render and for every navigation, so pages are always built from fresh server data. For documents that do not change per visitor, `prerender = true` writes HTML at build time and `revalidate` adds expiry-aware ISR ([Prerender & ISR](/guides/prerender-and-isr)). For explicit HTTP caching, call `setHeader` in a loader or API handler.

## What Moons deliberately does not do

Moons is not Remix with a new router. It is built around one guarantee: server code cannot leak into the client bundle, and an attempt fails the build instead of shipping. Every missing feature below moves code across that line or hides where it runs, so it is refused, not scheduled.

- **No React Server Components.** There is no `"use client"` boundary and no async component. Server-only code lives in `*.server.ts` and is reached through `serverFn`; page data comes from loaders.
- **No streaming or Suspense data APIs.** No `defer()`, `<Await>`, `clientLoader`, or `HydrateFallback`. The document is rendered completely before it is sent; pending UI comes from `useNavigation()`.
- **No form actions.** There is no `action` export and no framework-managed form submission state. The pattern is client validation plus a `serverFn` call plus `refresh()`; posting to `src/api` returns the no-JavaScript path.
- **No built-in auth or sessions.** There is no `createCookieSessionStorage` equivalent. Read a signed cookie in `context(req)`, expose it on `ctx`, and guard loaders and handlers ([Authentication](/guides/authentication)).
- **No ORM.** Bring your own driver in a `*.server.ts` module and query it through `serverFn` ([Working with Databases](/guides/databases)).
- **No edge or serverless adapter.** `moons build` produces `dist/client` plus a `node:http` server entry that runs on Bun and Node; prerendered paths can be served by a plain static host. There is no per-platform preset or adapter package.
- **No image or font optimization.** Use `<img>` with explicit dimensions, CSS, and self-hosted or system fonts; static files live in `dist/client`.

The replacement pattern is always the same three moves: load with a `loader`, mutate with a `serverFn`, re-render with `refresh()`. [Architecture](/architecture) explains the enforcement layers; [Zero-Trust Model](/core-concepts/zero-trust) covers what stays your responsibility.

## Gotchas

- **`*.server.ts` is the contract.** The suffix (or `src/server/**`) is what marks a module server-only. Everything else a route module imports is client code: a database helper named `db.ts` outside `src/server/**` ships to the browser, and so does a literal secret written in a route file.
- **Schemas are public.** The stub carries the `input` and `output` schemas so both sides can validate. Treat literals and messages as public; put sensitive checks in the handler.
- **Loader data is embedded in the HTML.** It is public the moment the page renders. Return only what the page displays; do credential work in `serverFn` handlers.
- **Raw `src/api` routes do their own origin and CSRF checks.** The RPC transport requires `x-moons: 1` and checks `Origin`; raw endpoints do not. Verify sessions and signatures in the handler, exactly as you would verify a webhook.
- **`refresh()` re-runs the current URL, and component state does not survive it.** The tree is re-hydrated on every document swap, so optimistic local state is thrown away. Keep durable state in the URL or in loader data, and use `useNavigation().pending` for the busy indicator — it tracks the refresh, not the RPC call.
- **`Link` takes route patterns, not URL paths.** `to="/notes/[id]"` with `params={{ id }}`; `navigate()` is the one that takes a URL path.
- **Search params come from the framework on both sides.** Loaders read `new URL(req.url).searchParams`, components read `useSearchParams()`; both are fed from the same request, so they always agree. Reading `window.location` breaks hydration parity.
- **Loaders return data, not responses.** `json()` is gone and returning a `Response` throws `E_INTERNAL`; redirect with `redirect()` (or `notFound()`), and set headers with `setHeader()`.
- **No client-side data layer.** `useFetcher`, `fetcher.load`, `clientLoader`, and `useRevalidator` have no 1:1 replacement. Call a `serverFn` from the event handler for imperative reads, keep local state for the result, and call `refresh()` when the route's own loader data must catch up.

## Checklist

Done when:

- `moons check` is green — typegen, `tsc --noEmit`, the client and server builds, and the prerender pass.
- `moons audit` reports `0 fail`; pass `--canary <value>` so the `dist/client` scan includes your leak canary.
- No handler body, `env()` secret, or canary value appears anywhere in `dist/client`.
- Loader return values contain nothing you would not put in the page source.
- Every raw `src/api` endpoint verifies its own caller.
- Migrated routes have tests before you delete the Remix app ([Testing](/guides/testing), [@moonsjs/cli](/api/cli) for `moons test`).

Next: [Migrating from Next.js](/guides/migrating-from-nextjs) covers the same migration from the other side, and [Your First App](/getting-started/first-app) is the fastest way to see the loader plus `serverFn` loop end to end.
