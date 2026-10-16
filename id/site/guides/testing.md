---
description: "Test in-process dengan createTestServer: dispatch Request tanpa port — pola test template bun test."
---

# Panduan: testing

Dua lapis yang disarankan:

## 1. Unit murni (`bun:test`)

Logika di `src/shared/` dan schema gampang dites tanpa framework:

```ts
import { expect, test } from "bun:test";
import { addNoteInput } from "../src/shared/schemas";

test("schema menolak judul kosong", () => {
  expect(addNoteInput.safeParse({ title: "" }).success).toBe(false);
});
```

## 2. HTTP in-process (`createTestServer`)

Jalankan handler tanpa port dan tanpa browser:

```ts
import { scanRoutes, type MoonsConfig, type RouteModule } from "@moonsjs/core";
import { createTestServer } from "@moonsjs/vite/server";

const routesDir = join(import.meta.dir, "..", "src", "routes");
const server = createTestServer({
  routes: scanRoutes(routesDir),
  config,
  routesDir,
  loadRoute: {
    _layout: async () => (await import("../src/routes/_layout")) as unknown as RouteModule,
    search: async () => (await import("../src/routes/search")) as unknown as RouteModule,
  },
});

const res = await server.fetch("/search?q=alp");
```

- `loadRoute` memetakan **route key** (lihat `bunx moons routes --json`) ke
  modul route; layout yang dipakai page juga harus disertakan.

## 3. Validasi stub client

Stub client memvalidasi sebelum fetch. Untuk mengujinya, bangun stub langsung
(`__moons_createStub` dari `@moonsjs/server/client`) dan ganti `globalThis.fetch`.

## E2E

Untuk bukti end-to-end (build + server nyata + canary): build → `moons start`
→ curl/RPC → pastikan `dist/client` bebas canary. Pola yang sama dijalankan
[cookbook](https://github.com/moonsjs/cookbook) di CI — tiru untuk pipeline Anda.

## Audit keamanan di CI

Jalankan `moons audit --json` setelah build. Ia mendata seluruh endpoint RPC, memetakan bacaan `env()`, memperingatkan cookie tanpa flag dan CSP yang hilang, lalu **gagal** begitu nilai env mirip-rahasia atau canary Anda muncul di `dist/client`.

> Jalankan `bunx moons check` sebelum menyatakan pekerjaan selesai.
