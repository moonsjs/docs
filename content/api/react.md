---
title: "@moonsjs/react"
description: Link and navigate, the data and navigation hooks, routing signals, and the client hydration entry for React route files.
---

`@moonsjs/react` is what route files import: `Link`, the hooks that read per-route data, the routing signals, and the response helpers re-exported from core. The browser entry point lives at the `@moonsjs/react/client` subpath.

## Link

```ts
type LinkProps<P extends keyof RouteMap> =
  RouteMap[P]["params"] extends Record<string, never>
    ? {
        to: P;
        params?: never;
        search?: Record<string, string | number | boolean | undefined>;
        prefetch?: boolean;
        children: ReactNode;
      }
    : {
        to: P;
        params: RouteMap[P]["params"];
        search?: Record<string, string | number | boolean | undefined>;
        prefetch?: boolean;
        children: ReactNode;
      };

function Link<P extends keyof RouteMap>(props: LinkProps<P>): JSX.Element;
```

| Prop | Type | Notes |
| --- | --- | --- |
| `to` | route key | File-style key such as `/users/[id]` |
| `params` | object | Required when the route has dynamic segments; pass a catch-all remainder as one string (`{ rest: "guides/setup" }`) |
| `search` | `Record<string, string \| number \| boolean \| undefined>` | Serialized into the query string; `undefined` values are skipped |
| `prefetch` | `boolean` | Default `true`; prefetches the page on hover/focus for internal links |
| `children` | `ReactNode` | Link content |

```tsx
import { Link } from "@moonsjs/react";

export function UserLink() {
  return (
    <Link to="/users/[id]" params={{ id: "u1" }} search={{ tab: "posts" }}>
      View profile
    </Link>
  );
}
```

`Link` renders an `<a href>` and intercepts plain left clicks for client-side navigation. Modified clicks, middle clicks, and `target` values other than `_self` are left to the browser.

## Data hooks

| Hook | Returns |
| --- | --- |
| `useLoaderData<typeof loader>()` | The loader result for the route module being rendered |
| `useParams<"/users/[id]">()` | Typed params for the current route |
| `useSearchParams()` | The query string as `Record<string, string>` |
| `useRouteError()` | The error behind the nearest `_error` boundary, or `undefined` |

```tsx
// src/routes/users/[id].tsx
import {
  useLoaderData,
  useParams,
  useSearchParams,
  type LoaderArgs,
} from "@moonsjs/react";

export const loader = async ({ params }: LoaderArgs<"/users/[id]">) => ({
  user: { id: params.id, name: "Ada" },
});

export default function User() {
  const { user } = useLoaderData<typeof loader>();
  const { id } = useParams<"/users/[id]">();
  const { tab } = useSearchParams();
  return (
    <h1>
      {user.name} ({id}) — {tab ?? "profile"}
    </h1>
  );
}
```

Route keys and params are precise once typegen has generated `.moons/routes.d.ts`; without it, `useParams` falls back to `Record<string, string>`. `useSearchParams` returns the value the loader saw, so server rendering and hydration always agree. See [Loaders](/core-concepts/loaders) for the loader side.

## Navigation state

```ts
interface NavigateOptions {
  replace?: boolean;
}

function navigate(href: string, options?: NavigateOptions): void;
function useNavigation(): { pending: boolean; url: string | null };
function refresh(): void;
```

`useNavigation` reports an in-flight client navigation: `pending` becomes `true` while the next page is fetched, and `url` holds its target. During server rendering it returns the initial snapshot (`pending: false`), keeping the markup deterministic. `refresh()` re-runs the current URL through the document pipeline, re-executing loaders and rendering fresh data without a full reload — call it after a successful mutation.

`navigate(href, options?)` starts the same client-side navigation as a plain `Link` click, from code. `href` is a URL path, so use `Link` for typed route keys; `{ replace: true }` replaces the current history entry instead of pushing a new one. When no client runtime is active the call falls back to a document navigation, and bare fragments and external URLs are always left to the browser. Internal hrefs are normalized against the app's trailing-slash policy, the same way `Link` builds them.

```tsx
import { navigate, refresh, useNavigation } from "@moonsjs/react";

export function Toolbar() {
  const { pending } = useNavigation();
  return (
    <div aria-busy={pending}>
      <span>{pending ? "Loading…" : "Ready"}</span>
      <button type="button" onClick={() => refresh()}>
        Refresh
      </button>
      <button type="button" onClick={() => navigate("/settings")}>
        Settings
      </button>
    </div>
  );
}
```

More patterns live in [Navigation & Search Params](/core-concepts/navigation).

## Signals and response helpers

`notFound()`, `redirect()`, and the `RedirectStatus` type are re-exported from `@moonsjs/core`, as are the response helpers `setHeader`, `appendHeader`, `setCookie`, and `deleteCookie` with `CookieOptions`. Import them from this package in route files:

```tsx
import { redirect, setHeader, type LoaderArgs } from "@moonsjs/react";

const legacy: Record<string, string> = { old: "/about" };

export const loader = async ({ params }: LoaderArgs<"/docs/[slug]">) => {
  const target = legacy[params.slug];
  if (target !== undefined) redirect(target, 301);
  setHeader("cache-control", "no-store");
  return { slug: params.slug };
};
```

Option tables and error behavior live in [@moonsjs/core](/api/core); boundary pages and production behavior in [Error Handling](/core-concepts/error-handling).

## Types

```ts
interface LoaderArgs<P extends string = string> {
  params: ParamsFor<P>;
  ctx: Ctx;
  req: Request;
}

interface RouteMap {}

interface RouteMeta {
  title?: string;
  description?: string;
  [key: string]: unknown;
}

type RouteMetaFn<L extends (...args: never[]) => unknown> = (args: {
  data: Awaited<ReturnType<L>>;
}) => RouteMeta;
```

`RouteMap` ships empty and is augmented by typegen, which is what makes `to`, `useParams`, and `LoaderArgs` check against the routes that actually exist. `RouteMeta` describes what a page's `meta` export returns; `title` and `description` are applied to the document head, and the index signature allows the fields you need. `RouteMetaFn<typeof loader>` types that export against its loader data:

```tsx
// in the same route file as the loader above
import { type RouteMetaFn } from "@moonsjs/react";

export const meta: RouteMetaFn<typeof loader> = ({ data }) => ({
  title: `User ${data.user.name}`,
});
```

## Client entry

```ts
// @moonsjs/react/client
function hydrate(): Promise<void>;
```

`hydrate()` is called once from `src/client/main.tsx`. It reads the server payload, hydrates `#root`, and registers client-side navigation, prefetching, and scroll restoration:

```tsx
// src/client/main.tsx
import { hydrate } from "@moonsjs/react/client";

await hydrate();
```
