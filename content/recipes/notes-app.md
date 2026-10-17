---
title: Notes App
description: Build a small notes app with a shared schema, a server-only store, a loader, and a mutation that refreshes the list.
---

This recipe builds a notes page end to end: a form, a list, one schema shared by both sides, and a store that never reaches the browser. It is the smallest useful example of the [serverFn](/core-concepts/server-fn) and [loader](/core-concepts/loaders) loop.

## What we are building

- `moons.config.ts` adds a request id to `ctx`.
- `src/shared/schemas.ts` holds the note shapes used by the client and the server.
- `src/server/notes.server.ts` owns the in-memory store and both server functions.
- `src/routes/notes/_layout.tsx` wraps the notes section.
- `src/routes/notes/index.tsx` lists notes and adds new ones.

```ts
// moons.config.ts
import { defineConfig } from "@moonsjs/core";

export default defineConfig({
  routesDir: "src/routes",
  context: async () => ({ requestId: crypto.randomUUID() }),
});
```

```ts
// src/shared/schemas.ts
import { z } from "zod";

export const addNoteInput = z.object({
  title: z.string().min(1).max(80),
});

export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.date(),
});

export const noteListSchema = z.array(noteSchema);
```

The store and the handlers live together in a server-only file:

```ts
// src/server/notes.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";
import { addNoteInput, noteListSchema, noteSchema } from "../shared/schemas";

type Note = z.infer<typeof noteSchema>;

const notes = new Map<string, Note>([
  [
    "welcome",
    {
      id: "welcome",
      title: "Welcome to Moons",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
  ],
]);

export const listNotes = serverFn({
  input: z.object({}),
  output: noteListSchema,
  handler: async ({ ctx }) => {
    console.log(`listNotes (${ctx.requestId})`);
    return [...notes.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  },
});

export const addNote = serverFn({
  input: addNoteInput,
  output: noteSchema,
  handler: async ({ input, ctx }) => {
    const note: Note = {
      id: crypto.randomUUID(),
      title: input.title,
      createdAt: new Date(),
    };
    notes.set(note.id, note);
    console.log(`addNote (${ctx.requestId}): ${note.id}`);
    return note;
  },
});
```

Both handlers receive `ctx`; the log lines read `ctx.requestId` from the config above so server work can be correlated with a request.

The layout is optional, but it shows where a section-level shell belongs:

```tsx
// src/routes/notes/_layout.tsx
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

The page reads the list from the loader and calls the mutation from the form:

```tsx
// src/routes/notes/index.tsx
import { refresh, useLoaderData, useNavigation } from "@moonsjs/react";
import { useState } from "react";
import { addNote, listNotes } from "../../server/notes.server";
import { addNoteInput } from "../../shared/schemas";

export const loader = async () => ({
  notes: await listNotes({ input: {} }),
});

export default function NotesPage() {
  const { notes } = useLoaderData<typeof loader>();
  const { pending } = useNavigation();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = saving || pending;

  async function submit(): Promise<void> {
    setError(null);
    const parsed = addNoteInput.safeParse({ title });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a title.");
      return;
    }

    setSaving(true);
    try {
      await addNote({ input: parsed.data });
      setTitle("");
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add the note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <h1>Notes</h1>
      <form
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
        <button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Add note"}
        </button>
      </form>

      {error !== null ? <p role="alert">{error}</p> : null}
      {pending ? <p role="status">Refreshing the list...</p> : null}

      <ul>
        {notes.map((note) => (
          <li key={note.id}>
            <strong>{note.title}</strong>{" "}
            <time dateTime={note.createdAt.toISOString()}>
              {note.createdAt.toISOString().slice(0, 10)}
            </time>
          </li>
        ))}
      </ul>
      {notes.length === 0 ? <p>No notes yet.</p> : null}
    </main>
  );
}
```

## How it works

The loader calls `listNotes` like a normal async function. During the first render the call is in-process on the server, and the returned array is embedded in the document for hydration. During a client-side navigation the whole page is fetched and rendered on the server again, so the list is always rebuilt from the store.

The form does not post to an endpoint. It validates with `addNoteInput`, calls `addNote`, and then calls `refresh()`. The server function travels as an RPC call: the client stub sends the validated input to the function's hash, the server validates it again, runs the handler, and validates the return value against `noteSchema`. The `Map` and the seed note stay in the server bundle.

`refresh()` re-runs the current URL through the document pipeline, so the loader executes on the server and the page is re-rendered with the new note. It does not patch the list locally. `useNavigation().pending` turns true while that document fetch is in flight; the local `saving` flag covers the RPC call before the refresh starts. Together they keep the button disabled for the whole round trip.

## Notes

The store is a `Map`, so it resets when the process restarts. That is deliberate for a recipe; replace it with a database and keep the same serverFn boundary. See [Databases](/guides/databases).

The boundary is the point: `notes.server.ts` is replaced by a stub in the browser, and only the server functions cross. Schemas must be inline expressions or imports from a client-safe module such as `src/shared/schemas.ts`. A schema declared as a local constant inside the server file would fail the build with `E_SCHEMA_LOCAL_REF`, because the declaration is removed with the handler. [Zero-Trust Model](/core-concepts/zero-trust) explains the enforcement.

The date is rendered with `toISOString()` rather than a locale-dependent method. Server and browser locales can differ, and a mismatch would break hydration. Next, [Form Submission + Revalidation](/recipes/forms-revalidation) takes the same loop further with server errors and a no-JavaScript fallback.
