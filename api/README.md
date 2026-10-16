# Referensi API — Moons v1

> Referensi implementasi untuk **source yang ada di repo ini** (v1, pre-1.0) —
> titik masuk per paket; riwayat internal (spesifikasi, keputusan, catatan
> milestone) hidup di repo — bukan di situs.
>
> Halaman **per paket** adalah titik masuk; catatan riwayat per milestone
> (M1–M7) sengaja **tidak diterbitkan** — arsipnya di `docs/milestones/`
> (internal). Struktur dokumentasi: `docs/decisions/0025-docs-ia.md`.

## Package

| Package | Import | Isi |
|---|---|---|
| [`@moonsjs/core`](./core.md) | `@moonsjs/core`, `@moonsjs/core/serialize`, `@moonsjs/core/signals`, `@moonsjs/core/response` | Router, scan/typegen, config, error serialisasi loader/middleware runner, helper sinyal & respons |
| [`@moonsjs/server`](./server.md) | `@moonsjs/server`, `@moonsjs/server/client` | `serverFn`, registry, RPC `env`, stub client `cache`, kolektor respons |
| [`@moonsjs/react`](./react.md) | `@moonsjs/react`, `/client`, `/internal`, `/ssr` | Hooks, `Link` (+prefetch), SSR render, hydration, `useNavigation` |
| [`@moonsjs/vite`](./vite.md) | `@moonsjs/vite`, `/server`, `/transform` | Plugin (transform zero-trust) + runtime server + prerender/ISR |
| [`@moonsjs/cli`](./cli.md) | bin `moons` | `create`, `dev`, `build`, `start`, `typegen`, `routes`, `fns`, `check`, `errors` |
| [`@moonsjs/mcp`](./mcp.md) | bin `moons-mcp` | MCP server (stdio): `list_routes`, `get_fn_registry`, `run_check`, `search_docs`, `explain_error` + paket konteks agen |

## Lintas package

- **Error**: format; katalog runtime `MOONS_ERROR_CODES` (22 kode);
  katalog terstruktur: `moons errors --json` / MCP `explain_error`.
- **Virtual module** (semua `\0`-prefix): `virtual:moons/routes`,
  `virtual:moons/api`, `virtual:moons/config`, `virtual:moons/client-entry`,
  `virtual:moons/server-entry` — lihat [`vite.md`](./vite.md).
- **Global runtime server**: `globalThis.__moons_ssr`, `globalThis.__moons_callInProcess`
 (di-set saat `@moonsjs/server` dimuat) — dipakai stub 
- **Ctx**: tipe global dari `.moons/context.d.ts` hasil typegen;
 `ctx.__prerender === true` saat build prerender.
- **Plugin config (`plugins`)**: tipe divalidasi ketat (key di luar
  bentuk → `E_CONFIG_INVALID`) dan **dieksekusi** — `addRoute`/`addMiddleware`
  (observasi), `extendContext` (merge ctx per request), `onStart`/`onReady`/
 `onShutdown` — dan `../decisions/0022-m7-kontrak-ux.md`.
