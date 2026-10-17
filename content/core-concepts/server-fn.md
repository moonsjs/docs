---
title: serverFn
description: Declare server-only functions with typed schemas, call them from loaders or the browser, and revalidate with refresh().
---

A `serverFn` is a function that lives in a `*.server.ts` file and can be called from anywhere — loaders, middleware, or browser components — while its code stays on the server. It is the only thing that may cross the server/client boundary.

## Anatomy

The shape is `serverFn({ input, output, handler })`:

```ts
// src/server/notes.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";

const notes = new Map<string, { id: string; title: string }>();

export const addNote = serverFn({
  input: z.object({ title: z.string().min(1).max(80) }),
  output: z.object({ id: z.string(), title: z.string() }),
  handler: async ({ input, ctx }) => {
    console.log(`addNote (${ctx.requestId}): ${input.title}`);
    const note = { id: crypto.randomUUID(), title: input.title };
    notes.set(note.id, note);
    return note;
  },
});

export const listNotes = serverFn({
  input: z.object({}),
  output: z.array(z.object({ id: z.string(), title: z.string() })),
  handler: async () => [...notes.values()],
});
```

- `input` — a schema for the arguments. Zod works out of the box; any Standard Schema compatible library does too.
- `output` — a schema for the return value.
- `handler` — receives `{ input, ctx }`. `input` is already validated and typed from the input schema; `ctx` is your request context.

Schemas must be inline expressions or imports from client-safe modules. A schema that references a local declaration in the same `*.server.ts` file fails the build with `E_SCHEMA_LOCAL_REF`, because the client stub only carries imports and schema expressions — the local declaration would be `undefined` in the browser. The fix is moving shared schemas to a shared module:

```ts
// src/shared/schemas.ts
import { z } from "zod";

export const addNoteInput = z.object({ title: z.string().min(1).max(80) });
```

```ts
// src/server/notes.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";
import { addNoteInput } from "../shared/schemas";

export const addNote = serverFn({
  input: addNoteInput,
  output: z.object({ id: z.string(), title: z.string() }),
  handler: async ({ input }) => ({ id: crypto.randomUUID(), title: input.title }),
});
```

## Calling a serverFn

The call shape is always a single argument object: `fn({ input })`.

From a loader, the call is an in-process function call. The SSR runtime provides `ctx` for the request and no HTTP happens:

```tsx
// src/routes/notes/index.tsx
import { useLoaderData } from "@moonsjs/react";
import { listNotes } from "../../server/notes.server";

export const loader = async () => {
  return { notes: await listNotes({ input: {} }) };
};

export default function Notes() {
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

From a component that runs in the browser, the same import works, but it is now an RPC call. The build replaces the module with a stub that posts the input to a `/_moons/fn/<hash>` endpoint and parses the response. You do not manage URLs, headers, or serialization by hand — the stub does it, and the call site looks identical to the in-process one.

## Two-sided validation

The stub checks the input against the schema before the request and validates the response against the output schema; the server checks the input again before the handler runs and validates the return value against the output schema. Invalid input never reaches the handler. You get a `[moons]` error instead:

```bash
[moons] E_RPC_INVALID_INPUT

input does not match the schema: title: <issue message from the schema library>

Suggestion:
  1. Check the argument types at the call site, or
  2. Update the `input` schema
```

If the handler returns a shape the output schema rejects, the error is `E_RPC_INVALID_OUTPUT`; the server-side error includes the file, line, and export name of the `serverFn`. Both errors mean the same thing: fix the call site or fix the schema, never both silently.

A practical consequence: the output schema is a contract, not decoration. If you widen the handler's return value, widen the schema in the same commit, or callers will fail validation at runtime even though TypeScript is happy.

## Secrets with env()

`env()` from `@moonsjs/server` reads the process environment and is legal only in server code. Calling it in a client module fails the build with `E_ENV_IN_CLIENT`. Use it inside `*.server.ts`, for example to power a session helper:

```ts
// src/server/session.server.ts
import { env, serverFn, signCookie } from "@moonsjs/server";
import { z } from "zod";

const secret = env<string>("SESSION_SECRET");

export const createSession = serverFn({
  input: z.object({ userId: z.string().min(1) }),
  output: z.object({ token: z.string() }),
  handler: async ({ input }) => {
    const token = await signCookie({ userId: input.userId }, secret, {
      expiresIn: 60 * 60 * 24,
    });
    return { token };
  },
});
```

Public values use Vite's `import.meta.env.VITE_*` mechanism instead. Never return `env()` secrets from a loader — loader data is embedded in the HTML payload.

## When to prefer src/api

Raw endpoints under `src/api` are plain HTTP handlers. Choose them when:

- A third party calls the endpoint with its own protocol, like a payment webhook.
- You need full control of the response body, like an XML sitemap or a file download.
- You handle bodies the RPC layer is not meant for, like large multipart uploads.

Keep in mind that raw endpoints do not get the RPC origin checks, so you verify signatures and tokens yourself. For everything that is "my own app calling my own server", prefer `serverFn`.

## refresh() after a mutation

After a successful mutation, call `refresh()` to re-run the current page's loaders and render with fresh data:

```tsx
// src/routes/notes/index.tsx — client-side submit handler
import { refresh } from "@moonsjs/react";
import { addNote } from "../../server/notes.server";

async function onSubmit(title: string) {
  await addNote({ input: { title } });
  refresh();
}
```

`refresh()` re-runs the current URL through the document pipeline, so loaders execute on the server and the page re-renders without a full page reload.

Next: [Routing](/core-concepts/routing) for where loaders live, and [Architecture](/architecture) for how the boundary is enforced.
