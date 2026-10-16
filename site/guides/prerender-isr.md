---
description: "Static prerendering (SSG) with prerender/paths, the fail-closed leak guard, and ISR (revalidate) with stale-while-revalidate."
---

# Prerendering (SSG) & ISR

```tsx
// src/routes/blog/index.tsx — static page
export const prerender = true;

export default function BlogIndex() {
  return <p>blog</p>;
}
```

```tsx
// src/routes/blog/[slug].tsx — dynamic REQUIRES `paths`
export const prerender = true;
export const paths = () => [{ slug: "hello" }, { slug: "kedua" }];

export const loader = async ({ params }: LoaderArgs<"/blog/[slug]">) => ({
  title: posts[params.slug],
});
```

- `prerender: true` is page-only and renders at build time.
- Dynamic route without `paths` → **build fails** (`E_PRERENDER_NO_PATHS`).
- Build-time loader: synthetic `req` (no cookies/auth), `ctx.__prerender === true`
  so loaders can branch. `env()` is allowed — but never return secrets.
- `notFound()` skips the path (runtime 404 stays SSR); `redirect()` at build
  fails (`E_PRERENDER_INVALID`).
- Output: `dist/client/<path>/index.html` + a `_moons_prerender.json` manifest;
  the static server serves only manifested paths (everything else stays SSR).
- Middleware does not run at build time (static files get no middleware headers).

## Zero-trust guard (important)

A payload scan runs in **fail mode** during prerender: if the HTML contains the
`leakTest.canary` or a secret-looking env value (≥12 chars) the build **fails**
with `E_PRERENDER_LEAK` — static leakage is permanent.

## ISR / `revalidate` 

```tsx
export const prerender = true;
export const revalidate = 60; // seconds; 0 = regenerate on every request
```

- When a static file is stale, the server serves it (stale-while-revalidate)
  and regenerates it in the background via in-process SSR.
- Regeneration is **fail-closed**: leaking HTML is never written (old file kept).
- Atomic writes, deduped per path; non-200/redirect never overwrite.
- Invalid value or `revalidate` without `prerender` → `E_ISR_INVALID`.
- Single-instance limitation: use a CDN/reverse proxy or a shared store for
  multi-instance setups; no programmatic invalidation yet.

## Multiple instances

Each instance keeps its own files by default, so regenerations do not propagate. Configure a shared `isr.storage` (a `PrerenderStorage` with `read`/`write`) to serve and regenerate pages across instances — see the Vite reference for the shape.
