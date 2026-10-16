# `@moonsjs/react`

Public hooks, `Link`, SSR render, and hydration.

## Public — `@moonsjs/react`

```ts
function useLoaderData<T extends (...args: any) => any>(): Awaited<ReturnType<T>>;
function useParams<P extends string = string>(): ParamsFor<P>;
function useRouteError(): unknown;

type LinkProps<P extends keyof RouteMap> =
  RouteMap[P]["params"] extends Record<string, never>
    ? { to: P; params?: never; children: React.ReactNode }
    : { to: P; params: RouteMap[P]["params"]; children: React.ReactNode };

function Link<P extends keyof RouteMap>(props: LinkProps<P>): JSX.Element;

interface LoaderArgs<P extends string = string> { params: ParamsFor<P>; ctx: Ctx; req: Request; }
interface RouteMeta { title?: string; description?: string; [key: string]: unknown; }
interface RouteMap {}   // di-augmentasi .moons/routes.d.ts (typegen)
```

- `useLoaderData<typeof loader>()` — the loader data for the route module
  currently being rendered (page or layout) from the nearest provider.
- `useParams<"/users/[id]">` — route keys use the file form; `ParamsFor<P>` is
  precise once `.moons/routes.d.ts` has been generated, falling back to
  `Record<string, string>` when RouteMap is empty.
- `useRouteError` — the `_error` page error (M3); `undefined` outside an error
  context.
- `Link`:
  - `to` = a file-style `RouteMap` key (`/users/[id]`); `params` are filled in
    according to the key.
  - Renders `<a href>`; a left click without modifiers → client-side navigation;
 Ctrl/Cmd/Shift/middle/`target="_blank"` → browser behavior.
  - Catch-all: `params.rest` may contain `a/b` (each segment is encoded
    separately).

## Internal subpaths

### `@moonsjs/react/client`

```ts
function hydrate(): Promise<void>;
```

Called once from `src/client/main.tsx`:

```tsx
import { hydrate } from "@moonsjs/react/client";
await hydrate();
```

Reads `<script id="__moons_data" type="application/x-moons">`, revives a
`SerializedError` if present, loads route modules from the client manifest
(`virtual:moons/client-entry`), calls `hydrateRoot` on `#root`, then registers
SPA navigation (document fetch + `#root` swap + `pushState`; `popstate` is
supported; falls back to a reload when the fetch fails or is non-200).

### `@moonsjs/react/ssr`

```ts
function renderToMarkup(
  entry: ClientRouteEntry,
  modules: LoadedRoute,
  params: Record<string, string>,
  data: Record<string, unknown>,
  error?: unknown,     // halaman _error (dev); RouteErrorProvider
): string;
```
Used by `@moonsjs/vite/server`.

### `@moonsjs/react/internal`

`renderTree` (an identical server/client tree: `ParamsProvider` → layouts
root→leaf → page, each with a `LoaderDataProvider`), providers
(`ParamsProvider`, `LoaderDataProvider`, `RouteErrorProvider`), and the types
`ClientRouteEntry`, `RouteModuleShape`, `LoadedRoute`. Used by the framework
runtime (virtual modules & server handler), not by apps.

## Hydration contract

- The server renders markup + a devalue payload; the client must produce an
  identical tree. Any mismatch → a hydration error in the console.
- Rich types (`Date`, `Map`, `Set`, `BigInt`, `undefined`, `NaN`) survive thanks
  to devalue; the payload is HTML-escaped and read via `JSON.parse` →
  `devalue.parse`.
