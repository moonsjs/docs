---
title: Moons
template: splash
description: Framework full-stack TypeScript zero-trust — kode server diganti stub di client, upaya menembusnya menggagalkan build.
head:
  - tag: title
    content: Moons — framework full-stack TypeScript zero-trust
hero:
  title: Moons
  tagline: Framework full-stack TypeScript yang membuat kebocoran kode server ke client mustahil.
  actions:
    - text: Mulai cepat
      link: /mulai/mulai-cepat/
      icon: rocket
    - text: Kenapa zero-trust?
      link: /keamanan/
      icon: padlock
---

## Fitur unggulan

- **[Jaminan zero-trust](/keamanan/)** — file `*.server.ts` diganti stub RPC di
  bundle client; upaya menembusnya **menggagalkan build**, bukan sekadar
  "berisiko".
- **File routing + SSR + hidrasi React** — `src/routes/index.tsx` → `/`,
  `users/[id].tsx` → `/users/:id`, `[...rest]` untuk catch-all.
- **`loader` server-side bertipe** — `useLoaderData<typeof loader>()`; data
  kaya (`Date`, `Map`, `Set`) melewati server→client tanpa cast berkat devalue.
- **[serverFn](/dasar/server-fn/) dengan validasi dua sisi** — satu schema
  (Standard Schema; Zod mis.) dipakai client **dan** server.
- **Query param + revalidasi bawaan** — [`Link search`](/dasar/navigasi/),
  `useSearchParams()`, `refresh()` pasca-mutasi.
- **AI-first** — [paket konteks agen](/ai/context/), `llms.txt`/`llms-full.txt`,
  CLI JSON (`routes|fns|check --json`), dan MCP server.

## Mulai dalam 30 detik

```bash
bunx --package @moonsjs/cli moons create my-app
cd my-app
bun run dev            # http://localhost:3000
```

Lalu: [struktur proyek](/mulai/struktur-proyek/) · [routing](/dasar/routing/) ·
[loader](/dasar/loader/) · [serverFn](/dasar/server-fn/).

## Contoh & referensi

- [Cookbook](https://github.com/moonsjs/cookbook) — pola kanonik yang diuji CI.
- [Referensi API](/api/) — `core`, `server`, `react`, `vite`, `cli`, `mcp`.
- [Arsitektur](/manifest/) — mengapa batas server/client berbahaya dan
  bagaimana Moons menegakkannya.
