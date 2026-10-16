---
description: "Build produksi, NODE_ENV, health check /_moons/health, Docker multi-stage dari template, dan checklist deploy."
---

# Panduan: build & deploy

## Build

```bash
bunx moons build       # dist/client/** + dist/server/index.js
```

Build menjalankan seluruh transform zero-trust + leak test; bila canary bocor
atau ada import ilegal, build **gagal** (bukan peringatan).

## Jalankan

```bash
bunx moons start       # set NODE_ENV=production + jalankan dist/server/index.js
```

- Health check: `GET /_moons/health` → `{"ok":true}` (tetap hidup walau kode
  user rusak).
- Graceful shutdown: SIGTERM → berhenti menerima koneksi → drain request
  in-flight → exit 0.
- `NODE_ENV=production` dipastikan oleh `moons start`; production **tidak
  pernah** mengirim detail error ke payload. (Kalau menjalankan
  `dist/server/index.js` manual, set `NODE_ENV=production` sendiri.)

## Runtime

- Node (≥ 20) dan Bun didukung; `@moonsjs/core` dan `@moonsjs/server` tidak
  memakai API khas Bun.
- Letakkan di belakang reverse proxy (nginx/Caddy) untuk TLS, atau pakai
  load balancer mana pun yang meneruskan `X-Forwarded-*`.
- **Edge/serverless bukan target v1** (lihat non-tujuan): jalankan sebagai
  proses Node/Bun biasa.

## Docker (template sudah menyediakan)

Template `moons create` membawa `Dockerfile` multi-stage + `.dockerignore`:

```bash
docker build -t my-app .
docker run -p 3000:3000 --env-file .env my-app
```

- Stage build: `bun install --frozen-lockfile` → `bun run build`.
- Stage runtime: hanya `package.json`, `node_modules`, dan `dist`; image
  menjalankan `bun dist/server/index.js` dengan `NODE_ENV=production`.
- Health check container: `GET /_moons/health`.

## Checklist produksi

1. `bunx moons check` hijau di CI, leak test merah = merge dilarang.
2. `leakTest.canary` di `vite.config.ts` tetap terpasang (jangan dihapus).
3. Rahasia hanya lewat `env()` di `*.server.ts`.
4. Monitoring: `/_moons/health` + log format `[moons] CODE` untuk kegagalan.
