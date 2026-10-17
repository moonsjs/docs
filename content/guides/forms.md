---
title: Forms & Mutations
description: Submit an HTML form to a server function, validate with one schema, show pending and error states, and refresh loader data.
---

A form is HTML first and a JavaScript enhancement second: wire it to a `serverFn`, validate with a shared schema, and keep a no-JavaScript fallback.

## Schema and server functions

One schema validates both sides; it lives in a client-safe module because the generated stub carries it into the browser.

```ts
// src/shared/schemas.ts
import { z } from "zod";

export const addNoteInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(80, "Keep it under 80 characters"),
});

export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
});
```

```ts
// src/server/notes.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";
import { addNoteInput, noteSchema } from "../shared/schemas";

const notes = new Map<string, { id: string; title: string }>();

export const listNotes = serverFn({
  input: z.object({}),
  output: z.array(noteSchema),
  handler: async () => [...notes.values()],
});

export const addNote = serverFn({
  input: addNoteInput,
  output: noteSchema,
  handler: async ({ input }) => {
    const note = { id: crypto.randomUUID(), title: input.title };
    notes.set(note.id, note);
    return note;
  },
});

export const deleteNote = serverFn({
  input: z.object({ id: z.string().min(1) }),
  output: z.object({ id: z.string() }),
  handler: async ({ input }) => {
    notes.delete(input.id);
    return { id: input.id };
  },
});
```

## The create form

The form has a real `action` and `method`, so it works without JavaScript; with JavaScript, `onSubmit` prevents navigation and calls the server function.

```tsx
// src/routes/notes.tsx
import { refresh, useLoaderData, useNavigation } from "@moonsjs/react";
import { useState, type FormEvent } from "react";
import { addNote, deleteNote, listNotes } from "../server/notes.server";
import { addNoteInput } from "../shared/schemas";

export const loader = async () => ({ notes: await listNotes({ input: {} }) });

export default function NotesPage() {
  const { notes } = useLoaderData<typeof loader>();
  const { pending, url } = useNavigation();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = addNoteInput.safeParse({ title: new FormData(form).get("title") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid title");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addNote({ input: parsed.data });
      form.reset();
      refresh();
    } catch {
      setError("Could not save the note. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setDeleting(id);
    setError(null);
    try {
      await deleteNote({ input: { id } });
      refresh();
    } catch {
      setError("Could not delete the note. Try again.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main>
      <form action="/api/notes" method="post" onSubmit={(event) => void onCreate(event)}>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" maxLength={80} required />
        <button type="submit" disabled={saving || pending}>
          {saving ? "Saving..." : "Add note"}
        </button>
      </form>

      {error !== null && <p role="alert">{error}</p>}
      {pending && <p role="status">Refreshing {url}...</p>}

      <ul>
        {notes.map((note) => (
          <li key={note.id}>
            {note.title}
            <form
              action="/api/notes"
              method="post"
              onSubmit={(event) => void onDelete(event, note.id)}
            >
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={note.id} />
              <button type="submit" disabled={deleting === note.id}>
                {deleting === note.id ? "Deleting..." : "Delete"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

The client `safeParse` avoids a round trip for obvious mistakes but is not a security boundary: the server validates the same schema again, so a malformed request never reaches the handler. A handler failure returns a generic error in production, hence the fixed catch messages.

## Pending states

`useNavigation()` reports document navigations, including the one started by `refresh()`. Its shape is `{ pending, url }`: `pending` is true while the refresh is in flight, and `url` is the target. It does not cover the `serverFn` request, so the example tracks that with `saving` and `deleting`.

After a successful create or delete, `refresh()` re-runs the current URL through the document pipeline. The loader calls `listNotes` again and the page re-renders with fresh data, without a full reload. See [Navigation & Search Params](/core-concepts/navigation) for the navigation lifecycle.

## The no-JavaScript fallback

Both forms post to `/api/notes`. The handler reuses the same server functions and redirects, so a browser without JavaScript performs a normal POST and lands on a fresh page.

```ts
// src/api/notes.ts
import { type ApiHandlerArgs } from "@moonsjs/server";
import { addNote, deleteNote } from "../server/notes.server";
import { addNoteInput } from "../shared/schemas";

export async function POST({ req }: ApiHandlerArgs): Promise<Response> {
  const form = await req.formData();

  if (form.get("intent") === "delete") {
    const id = String(form.get("id") ?? "");
    if (id.length > 0) await deleteNote({ input: { id } });
    return Response.redirect(new URL("/notes", req.url), 303);
  }

  const parsed = addNoteInput.safeParse({ title: form.get("title") });
  if (!parsed.success) {
    return new Response("Title must be between 1 and 80 characters.", { status: 400 });
  }
  await addNote({ input: parsed.data });
  return Response.redirect(new URL("/notes", req.url), 303);
}
```

API handlers return a standard `Response`, so a 303 redirect makes the browser follow up with a GET to `/notes`. The handler runs in the same request context, so the `serverFn` calls work in-process.

API routes are public by default: no origin check and no CSRF token. Add a session check in [middleware](/guides/middleware) or in the handler before relying on this fallback; see [Authentication](/guides/authentication) and [API Routes](/guides/api-routes).
