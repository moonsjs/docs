---
description: "One schema (Standard Schema/Zod) used on client and server; client-safe schemas and E_SCHEMA_LOCAL_REF."
---

# Two-sided validation

```ts
// src/shared/schemas.ts — client-safe
export const addNoteInput = z.object({ title: z.string().min(1).max(80) });
```

```ts
// src/server/notes.server.ts
export const addNote = serverFn({
  input: addNoteInput,
  output: z.object({ id: z.string(), title: z.string() }),
  handler: async ({ input }) => store.add(input),
});
```

Both sides are validated: the client stub checks input before fetch and output
after fetch; the server re-checks input before the handler and output after it.

- Schemas must be **inline expressions or imports**; referencing a local
  top-level declaration fails the build with `E_SCHEMA_LOCAL_REF` (the error
  shows a before/after diff; the fix is inlining or moving the schema to
  `src/shared/schemas.ts`).
- Schema packages must be client-safe (zod / any Standard Schema library).
