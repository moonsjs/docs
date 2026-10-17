---
title: Your First App
description: Add a route, link pages together, load data on the server, and call your first server function.
---

This page builds on a fresh [installation](/getting-started/installation) and walks through the moves you will repeat in every Moons app: define a route, link to it, load data on the server, and run server-only code through a `serverFn`.

## The home route

A route is a file in `src/routes`. The default export renders the page, and `src/routes/index.tsx` maps to `/`.

```tsx
// src/routes/index.tsx
export default function Home() {
  return (
    <main>
      <h1>My Moons app</h1>
      <p>This page rendered on the server and hydrated in the browser.</p>
    </main>
  );
}
```

## Add a route

To add another page, add another file: `src/routes/about.tsx` maps to `/about`.

```tsx
// src/routes/about.tsx
export default function About() {
  return (
    <main>
      <h1>About</h1>
      <p>Built with file-based routing.</p>
    </main>
  );
}
```

## Link between pages

Use `Link` from `@moonsjs/react` instead of a bare `<a>` tag. `Link` renders a real anchor, but a plain left-click becomes a client-side navigation: the target document is fetched, swapped, and hydrated without a full page reload. The URL bar, the browser history, and the back button keep working exactly as they do with plain links.

```tsx
// src/routes/index.tsx
import { Link } from "@moonsjs/react";

export default function Home() {
  return (
    <main>
      <h1>My Moons app</h1>
      <p>
        <Link to="/about">Read about the app</Link>
      </p>
    </main>
  );
}
```

## Load data on the server

Export a `loader` from a page module and read its result with `useLoaderData<typeof loader>()`. The loader runs on the server for the initial render and again on the server for every client-side navigation.

```tsx
// src/routes/index.tsx
import { Link, useLoaderData } from "@moonsjs/react";

export const loader = async () => {
  return { greeting: "Hello from the server", renderedAt: new Date() };
};

export default function Home() {
  const { greeting, renderedAt } = useLoaderData<typeof loader>();
  return (
    <main>
      <h1>{greeting}</h1>
      <p>rendered at {renderedAt.toISOString()}</p>
      <p>
        <Link to="/about">Read about the app</Link>
      </p>
    </main>
  );
}
```

Loader data is serialized with devalue, so `Date`, `Map`, `Set`, `BigInt`, and `undefined` survive the trip from server to client unchanged.

Keep loader return values public. The data is embedded in the HTML payload, so anyone can read it in the page source.

## Your first server function

Server-only code lives in `*.server.ts` files. Create `src/server/greet.server.ts` and declare a `serverFn` with zod schemas for input and output:

```ts
// src/server/greet.server.ts
import { serverFn } from "@moonsjs/server";
import { z } from "zod";

export const greet = serverFn({
  input: z.object({ name: z.string().min(1) }),
  output: z.object({ message: z.string() }),
  handler: async ({ input }) => {
    return { message: `Hello, ${input.name}!` };
  },
});
```

Call it from the loader like a normal async function. The call shape is always `fn({ input: {...} })`:

```tsx
// src/routes/index.tsx
import { Link, useLoaderData } from "@moonsjs/react";
import { greet } from "../server/greet.server";

export const loader = async () => {
  const { message } = await greet({ input: { name: "reader" } });
  return { message };
};

export default function Home() {
  const { message } = useLoaderData<typeof loader>();
  return (
    <main>
      <h1>{message}</h1>
      <p>
        <Link to="/about">Read about the app</Link>
      </p>
    </main>
  );
}
```

During SSR, the call runs in-process on the server — no HTTP round-trip. When the same import appears in code that runs in the browser, the file is replaced by a typed RPC stub: the handler body never ships to the client, only the schemas and a stable hash that identifies the function. The stub also keeps the import graph client-safe: anything the server module imports — database clients, API keys — stays on the server.

Both sides validate. The stub checks the input before sending the request and checks the response against the output schema; the server checks the input again before the handler runs and validates the handler's return value against the output schema. A mismatch produces `E_RPC_INVALID_INPUT` or `E_RPC_INVALID_OUTPUT` instead of silently passing bad data through.

One rule follows from this: schemas are public. Every literal and message inside `input` and `output` is part of the client bundle, so keep secrets out of schemas and enforce sensitive checks in the handler instead.

## Run it

Start the dev server with `bun run dev` and open http://localhost:3000. Edit `src/routes/index.tsx` and watch the greeting update; then click through to `/about` to see client-side navigation in action.

When you are ready, run `bun run check`. The pipeline transforms `greet.server.ts` into an RPC stub, verifies that the handler stayed out of the client bundle, and typechecks both sides of the call.

## Next steps

- [Routing](/core-concepts/routing) — dynamic segments, catch-alls, nested layouts, and boundaries.
- [serverFn](/core-concepts/server-fn) — errors, `env()`, mutations, and `refresh()`.
