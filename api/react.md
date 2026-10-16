# `@moonsjs/react`

Hooks publik, `Link`, SSR render, dan hydration.

## Publik — `@moonsjs/react`

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

- `useLoaderData<typeof loader>()` — data loader modul route yang sedang dirender
  (page atau layout) dari provider terdekat.
- `useParams<"/users/[id]">` — key route memakai bentuk file;
  `ParamsFor<P>` presisi bila `.moons/routes.d.ts` sudah di-typegen,
  fallback `Record<string, string>` bila RouteMap kosong.
- `useRouteError` — error halaman `_error` (M3); `undefined` di luar konteks error.
- `Link`:
  - `to` = key `RouteMap` gaya file (`/users/[id]`); `params` diisi sesuai key.
  - Merender `<a href>`; klik kiri tanpa modifier → navigasi client-side;
 Ctrl/Cmd/Shift/middle/`target="_blank"` → perilaku browser.
  - Catch-all: `params.rest` boleh berisi `a/b` (setiap segmen di-encode terpisah).

## Subpath internal

### `@moonsjs/react/client`

```ts
function hydrate(): Promise<void>;
```

Dipanggil sekali dari `src/client/main.tsx`:

```tsx
import { hydrate } from "@moonsjs/react/client";
await hydrate();
```

Membaca `<script id="__moons_data" type="application/x-moons">`,
me-revive `SerializedError` bila ada, memuat modul route dari manifest client
(`virtual:moons/client-entry`), `hydrateRoot` ke `#root`, lalu mendaftarkan
navigasi SPA (fetch dokumen + swap `#root` + `pushState`, `popstate` didukung;
fallback reload bila fetch gagal/non-200).

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
Dipakai `@moonsjs/vite/server`.

### `@moonsjs/react/internal`

`renderTree` (pohon identik server/client: `ParamsProvider` → layout root→leaf →
page, masing-masing dengan `LoaderDataProvider`), provider
(`ParamsProvider`, `LoaderDataProvider`, `RouteErrorProvider`), tipe
`ClientRouteEntry`, `RouteModuleShape`, `LoadedRoute`. Dipakai runtime framework
(virtual module & server handler), bukan aplikasi.

## Kontrak hydration 

- Server merender markup + payload devalue; client harus menghasilkan pohon
  identik. Ketidaksamaan → hydration error di console.
- Tipe kaya (`Date`, `Map`, `Set`, `BigInt`, `undefined`, `NaN`) dijaga devalue;
  payload di-escape aman HTML dan dibaca `JSON.parse` → `devalue.parse`.
